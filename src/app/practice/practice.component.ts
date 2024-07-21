import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
// https://github.com/kpdecker/jsdiff
import { BibleService } from '../services/bible.service';
import { BiblePassage } from '../classes/BiblePassage';
import { normalizeString, sanitizeText, saveCaretPosition } from '../utils/utils';
import { DiffType, WordChange } from '../classes/models';
import { Bible } from '../classes/Bible';
import { Subscription } from 'rxjs';

declare const annyang: any;

// Declare state enum
enum InputState {
  NONE,
  WAITING,
  NO_LOCK,
  CORRECT,
  ERRORS
}

@Component({
  selector: 'app-practice',
  templateUrl: './practice.component.html',
  styleUrls: ['./practice.component.scss'],
})
export class PracticeComponent
  implements OnDestroy
{
  attempt = '';
  annyang = annyang;
  recording = false;
  detectPassage = true;
  passage: BiblePassage | undefined = undefined;
  bible: Bible | undefined = undefined;
  subscriptions: Subscription[] = [];
  keyPressTimeout: any;
  InputState = InputState
  inputState = InputState.NO_LOCK;

  @ViewChild('input') input: ElementRef | null = null;
  @ViewChild('inputParent') inputParent: ElementRef | null = null;

  constructor(
    private _bibleService: BibleService,
    private ngZone: NgZone
  ) {
    this.subscriptions.push(
      this._bibleService.curBible.subscribe((bible) => {
        this.bible = bible;
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
          this.processDiff();
        });
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

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
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

  onKeyDown(e: KeyboardEvent) {
    this.attempt = this.input!.nativeElement.innerText;
    this.inputState = InputState.WAITING;

    // Clear existing timeout to reset the timer on new key press
    if (this.keyPressTimeout) {
      clearTimeout(this.keyPressTimeout);
    }

    // Check if the pressed key is a space
    if (e.key === ' ') {
      this.processDiff();
    } else {
      // Set a new timeout if the key is not a space
      this.keyPressTimeout = setTimeout(() => {
        this.processDiff();
      }, 3000); // 3000 milliseconds = 3 seconds
    }
  }

  toggleVoice() {
    if (annyang.isListening()) {
      annyang.abort();
    } else {
      annyang.start();
    }
  }
  
  // Need an async routine to get the Bible diff and update the UI with the results
  async processDiff() {
    if (!this.bible) {
      this.inputState = InputState.NONE;
      return;
    }

    let anchors = this.bible.anchorText(this.attempt);
    if(!this.canAutoLock(anchors, this.attempt)) {
      this.inputState = InputState.NO_LOCK;
      return;
    }
    this.passage = anchors[0][0];
    let diff: WordChange[] | undefined = this.bible.getFlatDiff(this.attempt, this.passage.i, this.passage.j, true);
    if (!diff) {
      this.inputState = InputState.NONE;
      throw new Error('Error getting diff');
    }
    this.updateUIWithDiff(diff);
    if (diff.length === 1 && diff[0].t === DiffType.UNCHANGED) {
      this.inputState = InputState.CORRECT;
    } else {
      this.inputState = InputState.ERRORS;
    }
  }

  updateUIWithDiff(diff: WordChange[]) {
    /*
    Using the diff, this function will first normalize the attempt, and for each diff (set of words)
    in the diff, it will normalize the diff, find the corresponding substring in the normalized attempt,
    create a span element with the appropriate class, and append it to the input element.
    */
    // Save selection position to restore after updating the UI
    let restorePosition = saveCaretPosition(this.input!.nativeElement);

    let [normalizedAttempt, normalizedAttemptMapping] = normalizeString(this.attempt);

    let fragment = document.createDocumentFragment();
    let curIndex = 0; // Index in the normalized attempt
    let originalAttemptEnd = -1;
    
    for (let i = 0; i < diff.length; i++) {
      const change = diff[i];
      let className = change.t == 0 ? "added" : change.t == 1 ? "removed" : "unchanged";
      // Normalize the diff
      let [normalizedDiff, normalizedDiffMapping] = normalizeString(change.v.join(''));
      // Find the corresponding substring in the normalized attempt
      if (change.t == 1) {
        continue;
      }

      let originalAttemptStart = normalizedAttemptMapping[curIndex];
      originalAttemptEnd = curIndex + normalizedDiff.length < normalizedAttemptMapping.length 
        ? normalizedAttemptMapping[curIndex + normalizedDiff.length ]
        : normalizedAttemptMapping[normalizedAttempt.length - 1] + 1;
      curIndex += normalizedDiff.length;
      // console.log(curIndex + normalizedDiff.length < normalizedAttemptMapping.length, "?", normalizedAttemptMapping[curIndex + normalizedDiff.length], normalizedAttemptMapping[normalizedAttempt.length -1 ] + 1);
      // console.log(originalAttemptStart, originalAttemptEnd, normalizedDiff, change.v.join(''));
      let span = document.createElement('span');
      span.textContent = this.attempt.substring(originalAttemptStart, originalAttemptEnd );
      span.classList.add(className);
      span.classList.add('input-text')
      if (change.t == 0 && i != 0 && diff[i-1].t == 1){
        span.setAttributeNS(null, 'matTooltip', diff[i-1].v.join(' '));
      }
      fragment.appendChild(span);
      // console.log("Original attempt end", originalAttemptEnd);
    }
    // Append the remaining text
    // console.log("Original attempt end", originalAttemptEnd);
    if (originalAttemptEnd < this.attempt.length) {
      // console.log(originalAttemptEnd)
      // console.log("Appending remaining text", this.attempt.substring(originalAttemptEnd));
      let span = document.createElement('span');
      span.textContent = this.attempt.substring(originalAttemptEnd);
      fragment.appendChild(span);
    }

    // Clear the input element and append the fragment
    this.input!.nativeElement.innerHTML = '';
    this.input!.nativeElement.appendChild(fragment);

    restorePosition();

  }
  
  handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    let text = e.clipboardData?.getData('text');
    if (!text) {
      return;
    }
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
    selection.collapseToEnd();
    this.attempt = this.input!.nativeElement.innerText;
    this.processDiff();
  }

  fixErrors() {
    if (!this.passage) {
      return;
    }
    const text = this.bible!.getText(this.passage.i, this.passage.j);
    this.input!.nativeElement.innerHTML = text;
    this.attempt = text;
    this.processDiff();
  }

  nextWord() {
    if (!this.passage) {
      return;
    }
    let nextIndex = this.passage.j;
    if (this.attempt.length > 0 && this.attempt[this.attempt.length - 1] !== ' ') {
      this.attempt += ' ';
    }
    const text = this.bible!.getText(nextIndex, nextIndex + 1);
    this.addToAttempt(text);
    const range = document.createRange();
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    range.setStart(this.input!.nativeElement, this.input!.nativeElement.childNodes.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  addToAttempt(text: string) {
    this.attempt += text;
    this.input!.nativeElement.appendChild(document.createTextNode(text));
    this.processDiff()
  }
}