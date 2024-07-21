import { Component, OnDestroy } from '@angular/core';
import { BiblePointer, Book, DiffType, Heatmap } from 'src/app/classes/models';
import { BibleService } from 'src/app/services/bible.service';
import { StorageService } from 'src/app/services/storage.service';
import { IResult } from 'src/app/classes/models';
import { BiblePassage } from 'src/app/classes/BiblePassage';
import { Bible } from 'src/app/classes/Bible';
import { Subscription } from 'rxjs';
import { intersection } from 'src/app/utils/utils';
import { Router } from '@angular/router';

enum FilterValues {
  PAST_DAY = 'Past Day',
  PAST_WEEK = 'Past Week',
  PAST_MONTH = 'Past Month',
  PAST_YEAR = 'Past Year',
  ALL_TIME = 'All Time',
}

@Component({
  selector: 'app-heatmap',
  templateUrl: './heatmap.component.html',
  styleUrls: ['./heatmap.component.scss'],
})
export class HeatmapComponent implements OnDestroy {
  filterValues = FilterValues;
  filterValue = FilterValues.ALL_TIME;
  heatmap: Heatmap = new Map();
  passage: BiblePassage = {} as BiblePassage;
  bible: Bible | undefined = undefined;
  subscriptions: Subscription[] = [];
  reference: BiblePointer | undefined = undefined;

  constructor(
    private _bibleService: BibleService,
    private _storageService: StorageService,
    private _router: Router,
  ) {
    this.subscriptions.push(
      this._bibleService.curBible.subscribe((bible) => {
        this.bible = bible;
        let loc = this._router.parseUrl(this._router.url).queryParams['loc'];
        this.setInitialSelectorState(loc);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  setInitialSelectorState(loc: string | undefined) {
    if (!this.bible) {
      return;
    }
    let i = 0;
    if (loc) {
      i = parseInt(loc);
    } else {
      i = this._storageService.getLastAttempt(this.bible.m.t)?.diff.i || 0;
    }
    let attemptStart = this.bible.get(i);
    this.reference = {
      book: attemptStart.book,
      chapter: attemptStart.chapter,
      verse: attemptStart.verse,
      index: 0,
    };
  }

  getBooks(): Book[] {
    if (this.bible === undefined) {
      return [];
    }
    return this.bible.v;
  }


  getFilterTimestamp(): number {
    let now = new Date().getTime();
    switch (this.filterValue) {
      case FilterValues.PAST_DAY:
        return now - 24 * 60 * 60 * 1000;
      case FilterValues.PAST_WEEK:
        return now - 7 * 24 * 60 * 60 * 1000;
      case FilterValues.PAST_MONTH:
        return now - 30 * 24 * 60 * 60 * 1000;
      case FilterValues.PAST_YEAR:
        return now - 365 * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  updateHeatmap() {
    if (!this.reference || !this.bible) {
      return;
    }
    this.passage = new BiblePassage(
      this.reference.chapter.m.i,
      this.reference.chapter.m.i + this.reference.chapter.m.l,
      this.reference.book,
      this.reference.chapter,
      this.reference.chapter.v[0],
      this.reference.book,
      this.reference.chapter,
      this.reference.chapter.v[this.reference.chapter.v.length - 1]
    );
    let chapterStart = this.reference.chapter.m.i;
    let chapterEnd = this.reference.chapter.m.i + this.reference.chapter.m.l;
    let filterTimestamp = this.getFilterTimestamp();
    let results: IResult[] = [
      ...this._storageService.getAttempts().values(),
    ].filter((a) => {
      return (
        a.timestamp > filterTimestamp &&
        a.diff.m.t === this.bible?.m.t &&
        intersection(a.diff.i, a.diff.j, chapterStart, chapterEnd)
      );
    });
    this.heatmap = new Map();
    for (let result of results) {
      this.updateHeatmapFromResult(result);
    }
  }

  updateHeatmapFromResult(result: IResult) {
    if (!this.reference) {
      return;
    }
    for (let bookDiff of result.diff.v) {
      if (this.reference.book.m.b !== bookDiff.m.b) {
        continue;
      }
      for (let chapterDiff of bookDiff.v) {
        if (this.reference.chapter.m.c !== chapterDiff.m.c) {
          continue;
        }
        for (let verseDiff of chapterDiff.v) {
          for (let wordDiff of verseDiff.v) {
            for (let i = 0; i < wordDiff.v.length; i++) {
              let curIndex =
                wordDiff.t === DiffType.ADDED ? wordDiff.i : wordDiff.i + i;
              let indexTotals = this.heatmap.get(curIndex);
              if (indexTotals === undefined) {
                indexTotals = [0, 0, 0];
                indexTotals[wordDiff.t] = 1;
                this.heatmap.set(curIndex, indexTotals);
              } else {
                indexTotals[wordDiff.t] += 1;
              }
            }
          }
        }
      }
    }
  }
}
