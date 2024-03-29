import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DiffType, IResult, ResultBank, VerseChange } from 'src/app/classes/models';
import { BibleService } from 'src/app/services/bible.service';
import { StorageService } from 'src/app/services/storage.service';
import { DisplayType } from '../diff-display/diff-display.component';


@Component({
  selector: 'app-single-attempt',
  templateUrl: './single-attempt.component.html',
  styleUrls: ['./single-attempt.component.scss']
})
export class SingleAttemptComponent implements OnInit {
  result_bank: ResultBank = {"results": []}
  diffTypes = DiffType;
  displayTypes = DisplayType;

  current_result: IResult | undefined = undefined;

  constructor(private _bibleService: BibleService, private _router: Router, private _storageService: StorageService) {}

  ngOnInit(): void {
    this.result_bank = this._storageService.getBank();
    let index = this._router.parseUrl(this._router.url).queryParams['i'];
    if(index != undefined){
      this.setResult(parseInt(index));
    } else {
      this.setResult(0);
    }

    
  }

  setResult(index: number): void {
    if(index < 0 || index > this.result_bank.results.length){
      this.current_result = undefined;
      return;
    }
    this.current_result = this.result_bank.results[index];
  }

  isScripture(diff: VerseChange): boolean {
    return diff.t === DiffType.Unchanged || diff.t === DiffType.Removed;
  }

  isAttempt(diff: VerseChange): boolean {
    return diff.t === DiffType.Unchanged || diff.t === DiffType.Added;
  }
}
