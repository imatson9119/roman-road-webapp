import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { DiffType, IResult, ResultBank, VerseChange } from 'src/app/classes/models';
import { StorageService } from 'src/app/services/storage.service';
import { DisplayType } from '../diff-display/diff-display.component';
import { numberToColorHsl } from 'src/app/utils/utils';
import { MatDialog } from '@angular/material/dialog';
import { DeleteAttemptDialogComponent } from './delete-attempt-dialog/delete-attempt-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Bible } from 'src/app/classes/Bible';
import { Subscription } from 'rxjs';
import { BibleService } from 'src/app/services/bible.service';


@Component({
  selector: 'app-single-attempt',
  templateUrl: './single-attempt.component.html',
  styleUrls: ['./single-attempt.component.scss']
})
export class SingleAttemptComponent implements OnInit, OnDestroy {
  result_bank: ResultBank = {"version":1,"results": new Map()};
  diffTypes = DiffType;
  displayTypes = DisplayType;
  resultId = "";

  currentResult: IResult | undefined = undefined;
  totalWords: number = 0;
  totalMistakes: number = 0;
  longestSequence: number = 0;
  bible: Bible | undefined = undefined;
  subscriptions: Subscription[] = [];
  


  constructor(private _router: Router, private _storageService: StorageService, private _bibleService: BibleService, private dialog: MatDialog, private snackbar: MatSnackBar, private _location: Location) {}

  ngOnInit(): void {
    this.result_bank = this._storageService.getBank();
    let id = this._router.parseUrl(this._router.url).queryParams['id'];
    if(id != undefined){
      this.setResult(id);
    } else {
      this._router.navigateByUrl('/history');
    }

    this.subscriptions.push(this._bibleService.curBible.subscribe(
      (bible) => {
        this.bible = bible;
      }
    ));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  setResult(id: string): void {
    if(!this.result_bank.results.has(id)){
      this._router.navigateByUrl('/history');
      return;
    }
    this.resultId = id;
    this.currentResult = this.result_bank.results.get(id);
    this.generateResultStats();
  }

  isScripture(diff: VerseChange): boolean {
    return diff.t === DiffType.UNCHANGED || diff.t === DiffType.REMOVED;
  }

  isAttempt(diff: VerseChange): boolean {
    return diff.t === DiffType.UNCHANGED || diff.t === DiffType.ADDED;
  }

  deleteResult(): void {
    if(this.currentResult === undefined || this.resultId === ""){
      return;
    }
    this.dialog.open(DeleteAttemptDialogComponent).afterClosed().subscribe(result => {
      if(result){
        this._storageService.deleteAttempt(this.resultId);
        this.snackbar.open('Result deleted.', 'Dismiss', {duration: 2000});
        this._location.back();
      }
    });
  }

  editResult(): void {
    if(this.currentResult === undefined || this.resultId === ""){
      return;
    }
    this._router.navigate(['/test'], { queryParams: { id: this.resultId } });
  }

  generateResultStats(): void {
    if(this.currentResult === undefined){
      return;
    }
    this.totalWords = 0;
    this.totalMistakes = 0;
    this.longestSequence = 0;
    let currentSequence = 0;
    for(let bookDiff of this.currentResult.diff.v){
      for(let chapterDiff of bookDiff.v){
        for(let verseDiff of chapterDiff.v){
          for(let change of verseDiff.v){
            if (change.t === DiffType.ADDED || change.t === DiffType.REMOVED){
              this.longestSequence = Math.max(this.longestSequence, currentSequence);
              currentSequence = 0;
              this.totalMistakes += change.v.length;
            } else {
              currentSequence += change.v.length;
            }
            this.totalWords += change.v.length;
          }
        }
      }
    }
    this.longestSequence = Math.max(this.longestSequence, currentSequence);
  }

  getColor(){
    if (!this.currentResult){
      return 'transparent';
    }
    let weightedScore = Math.max(0,this.currentResult.score * 2 - 1)
    return numberToColorHsl(1-weightedScore, .117, .32);
  }

  getAccuracy(): number {
    return this.currentResult ? Math.round(this.currentResult.score * 100) : 0;
  }
}
