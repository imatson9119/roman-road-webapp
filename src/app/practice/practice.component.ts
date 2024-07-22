import {
  ApplicationRef,
  Component,
  ElementRef,
  EnvironmentInjector,
  NgZone,
  OnDestroy,
  Renderer2,
  ViewChild,
  ViewRef,
  ViewContainerRef,
  createComponent,
} from '@angular/core';
// https://github.com/kpdecker/jsdiff
import { BibleService } from '../services/bible.service';
import { BiblePassage } from '../classes/BiblePassage';
import { normalizeString, sanitizeText, saveCaretPosition } from '../utils/utils';
import { DiffType, WordChange } from '../classes/models';
import { Bible } from '../classes/Bible';
import { Subscription } from 'rxjs';
import { DynamicSpanComponent } from './dynamic-span/dynamic-span.component';

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
  @ViewChild('input', { read: ViewContainerRef }) inputContainerRef: ViewContainerRef | null = null;


  constructor(
    private _bibleService: BibleService,
    private renderer: Renderer2,
    private injector: EnvironmentInjector,
    private appRef: ApplicationRef,
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

    // Check if the pressed key is a space
    if (e.key === ' ') {
      this.inputState = InputState.WAITING;
      this.processDiff();
    }
  }

  onChange() {
    this.inputState = InputState.WAITING;
    // Clear existing timeout to reset the timer on new key press
    this.attempt = this.input!.nativeElement.innerText;
    if (this.keyPressTimeout) {
      clearTimeout(this.keyPressTimeout);
    }
    this.keyPressTimeout = setTimeout(() => {
      this.processDiff();
    }, 3000); // 3000 milliseconds = 3 seconds
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
    const restorePosition = saveCaretPosition(this.input!.nativeElement);
    this.input!.nativeElement.innerHTML = '';

    const [normalizedAttempt, normalizedAttemptMapping] = normalizeString(this.attempt);

    let curIndex = 0; // Index in the normalized attempt
    let originalAttemptEnd = -1;
    
    for (let i = 0; i < diff.length; i++) {
      const change = diff[i];
      let className = change.t == 0 ? "added" : change.t == 1 ? "removed" : "unchanged";
      // Normalize the diff
      let [normalizedDiff, normalizedDiffMapping] = normalizeString(change.v.join(''));
      // Find the corresponding substring in the normalized attempt
      if (change.t == DiffType.REMOVED) {
        continue;
      }
      let originalAttemptStart = normalizedAttemptMapping[curIndex];
      originalAttemptEnd = curIndex + normalizedDiff.length < normalizedAttemptMapping.length 
        ? normalizedAttemptMapping[curIndex + normalizedDiff.length ]
        : normalizedAttemptMapping[normalizedAttempt.length - 1] + 1;
      curIndex += normalizedDiff.length;
      const text = this.attempt.substring(originalAttemptStart, originalAttemptEnd);
      let tooltip = '';
      if (change.t == DiffType.ADDED && i != 0 && diff[i-1].t == DiffType.REMOVED) {
        tooltip =  diff[i-1].v.join(' ');
        className = 'changed'
      }
      if (i != diff.length - 1 && diff[i+1].t == DiffType.REMOVED && (i == diff.length - 2 || diff[i+2].t != DiffType.ADDED)) {
        // Now we need to split into two spans, one with the unchanged text, then link the removed text
        // to the whitespace between the two spans. We can do this using regex matching backwards to 
        // find the whitespace.
        let match = text.match(/\s+$/);
        if (match) {
          let whitespace = match[0];
          console.log(whitespace);
          let whitespaceIndex = text.length - whitespace.length;
          let unchangedText = text.substring(0, whitespaceIndex);
          let removedText = text.substring(whitespaceIndex);
          this.addSpanToInput(unchangedText, className, tooltip);
          this.addSpanToInput(removedText, 'removed', diff[i+1].v.join(' '));
        }
        continue;
      }
      this.addSpanToInput(text, className, tooltip);
    }
    // Append the remaining text
    if (originalAttemptEnd < this.attempt.length) {
      this.addSpanToInput(this.attempt.substring(originalAttemptEnd));
    }

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
    this.addSpanToInput(text);
    this.processDiff()
  }

  addSpanToInput(text: string, className: string = '', tooltip: string = '') {
    const componentRef = this.inputContainerRef!.createComponent(DynamicSpanComponent);
    componentRef.setInput("displayText", text);
    componentRef.setInput("tooltipText", tooltip);
    componentRef.setInput("class", className)
    componentRef.changeDetectorRef.detectChanges();
    const elementRef = componentRef.location.nativeElement;
    this.input?.nativeElement.appendChild(elementRef);
    console.log(this.input?.nativeElement.innerText)
  }
} 