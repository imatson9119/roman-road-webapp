import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
// https://github.com/kpdecker/jsdiff
import { StorageService } from '../services/storage.service';
import { Router } from '@angular/router';
import { BibleService } from '../services/bible.service';
import { MatDialog } from '@angular/material/dialog';
import { PassageSelectDialogComponent } from '../passage-select-dialog.component/passage-select-dialog.component';
import { BiblePassage } from '../classes/BiblePassage';
import { getAttemptText, intersection, sanitizeText } from '../utils/utils';
import { BibleDiff, BiblePointer, DiffType } from '../classes/models';
import { v4 as uuidv4 } from 'uuid';
import { Bible } from '../classes/Bible';
import { Subscription } from 'rxjs';

declare const annyang: any;

@Component({
  selector: 'app-input',
  templateUrl: './input.component.html',
  styleUrls: ['./input.component.scss'],
})
export class InputComponent
  implements AfterViewChecked, OnDestroy
{
  attempt = '';
  annyang = annyang;
  recording = false;
  detectPassage = true;
  editingId = '';
  startRef: BiblePointer | undefined = undefined;
  endRef: BiblePointer | undefined = undefined;
  bible: Bible | undefined = undefined;
  subscriptions: Subscription[] = [];

  @ViewChild('input') input: ElementRef | null = null;
  @ViewChild('inputParent') inputParent: ElementRef | null = null;

  constructor(
    private _storageService: StorageService,
    private _bibleService: BibleService,
    private router: Router,
    private _dialog: MatDialog,
    private ngZone: NgZone
  ) {
    this.subscriptions.push(
      this._bibleService.curBible.subscribe((bible) => {
        this.bible = bible;

        let id = this.router.parseUrl(this.router.url).queryParams['id'];
        if (id != undefined) {
          this.editResult(id);
        } else {
          this.router.navigateByUrl('/test');
        }
      })
    );
    annyang.addCallback('result', (userSaid: string[] | undefined) => {
      if (userSaid && userSaid.length > 0) {
        ngZone.run(() => {
          if (
            this.attempt.length > 0 &&
            this.attempt[this.attempt.length - 1] !== ' '
          ) {
            this.attempt += ' ';
          }
          this.attempt += userSaid[0].trim();
        });
        this.adjustInputHeight();
      }
    });
    annyang.addCallback('end', () => {
      ngZone.run(() => {
        this.recording = false;
      });
    });
    annyang.addCallback('start', () => {
      ngZone.run(() => {
        this.recording = true;
      });
    });
  }

  ngAfterViewChecked(): void {
    this.adjustInputHeight();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  valid() {
    return (
      this.attempt.trim().length > 0 &&
      (this.detectPassage
        ? true
        : this.startRef &&
          this.endRef &&
          this.startRef.verse.m.i <= this.endRef.verse.m.i)
    );
  }

  editResult(id: string) {
    if (!this.bible) {
      return;
    }
    let result = this._storageService.getAttempt(id);
    if (result === undefined) {
      this.router.navigateByUrl('/test');
      return;
    }
    this.attempt = result.raw ? result.raw : getAttemptText(result);
    this.detectPassage = false;
    let start = this.bible.get(result.diff.i);
    let end = this.bible.get(result.diff.j - 1);
    this.startRef = {
      book: start.book,
      chapter: start.chapter,
      verse: start.verse,
      index: 0,
    };
    this.endRef = {
      book: end.book,
      chapter: end.chapter,
      verse: end.verse,
      index: 0,
    };
    this.editingId = id;
  }

  submit() {
    if (!this.valid() || !this.bible) {
      return;
    }
    this.annyang.abort();
    if (this.detectPassage) {
      let anchors = this.bible.anchorText(this.attempt);
      if (!this.canAutoLock(anchors, this.attempt)) {
        this._dialog
          .open(PassageSelectDialogComponent, {
            data: {
              title: 'Select a Passage',
              subtitle:
                "Oops, it looks like we couldn't find the passage you were reciting. Specify below!",
              options: anchors.map((a) => a[0]),
            },
          })
          .afterClosed()
          .subscribe((result: [number, number]) => {
            if (result && this.bible) {
              this.getAndStoreDiff(this.bible.getPassage(result[0], result[1]));
            }
          });
      } else {
        this.getAndStoreDiff(anchors[0][0]);
      }
    } else {
      if (!this.startRef || !this.endRef) {
        return;
      }
      let start = this.startRef.verse.m.i;
      let end = this.endRef.verse.m.i + this.endRef.verse.m.l;
      this.getAndStoreDiff(this.bible.getPassage(start, end));
    }
  }

  getAndStoreDiff(passage: BiblePassage) {
    if (!this.bible) {
      return;
    }
    let diff = this.bible.getBibleDiff(this.attempt, passage.i, passage.j);
    if (!diff) {
      throw new Error('Error getting diff');
    }
    let id = this.processDiff(diff);
    this.router.navigate(['/results'], { queryParams: { id: id } });
  }

  canAutoLock(anchorList: [BiblePassage, number][], attempt: string) {
    if (anchorList.length === 0) {
      return false;
    }
    let topAnchor = anchorList[0][0];
    return (
      anchorList[0][1] === 1 &&
      topAnchor.j - topAnchor.i < sanitizeText(attempt).split(/\s+/).length * 2
    );
  }

  adjustInputHeight() {
    if (this.input && this.inputParent) {
      let prevParentMinHeight = this.inputParent.nativeElement.style.minHeight;
      this.inputParent.nativeElement.style.minHeight =
        this.inputParent.nativeElement.offsetHeight + 'px';
      this.input.nativeElement.classList.add('measure-element');
      let height = this.input.nativeElement.scrollHeight;
      this.input.nativeElement.style.height = height + 'px';
      this.input.nativeElement.classList.remove('measure-element');
      this.inputParent.nativeElement.style.minHeight = prevParentMinHeight;
    }
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Enter') {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        this.attempt += '\n';
        return;
      }
      e.preventDefault();
      this.submit();
    }
  }

  toggleVoice() {
    if (annyang.isListening()) {
      annyang.abort();
    } else {
      annyang.start();
    }
  }

  processDiff(diff: BibleDiff): string {
    // Will want to make heatmap changes here as well
    let totalCorrect = 0;
    let totalWords = 0;
    let timestamp = Date.now();
    for (let book of diff.v) {
      for (let chapter of book.v) {
        for (let verse of chapter.v) {
          for (let change of verse.v) {
            if (change.t === DiffType.UNCHANGED) {
              totalCorrect += change.v.length;
            }
            totalWords += change.v.length;
          }
        }
      }
    }
    let score = totalCorrect / totalWords;
    let id = this.editingId ? this.editingId : uuidv4();

    let goalsApplied = new Set<string>();
    for (let goal of this._storageService.getGoals().values()) {
      if (intersection(goal.i, goal.j, diff.i, diff.j)) {
        goal.attempts.add(id);
      }
    }

    this._storageService.storeAttempt({
      id: id,
      diff: diff,
      timestamp: timestamp,
      score: score,
      raw: this.attempt,
      goals: goalsApplied,
    });

    return id;
  }

  togglePassageSelection() {
    this.detectPassage = !this.detectPassage;
  }
}
