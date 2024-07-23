import {
  ApplicationRef,
  Component,
  ElementRef,
  EnvironmentInjector,
  NgZone,
  OnDestroy,
  Renderer2,
  ViewChild,
  ViewContainerRef,
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

enum SpanClass {
  ADDED = 'added',
  REMOVED = 'removed',
  UNCHANGED = 'unchanged',
  CHANGED = 'changed'
}

class DynamicSpan {
  startIndex: number = -1;
  endIndex: number = -1;
  displayText: string = '';
  tooltipText: string = '';
  class: string = '';
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

  onChange(e: any) {
    this.attempt = this.input!.nativeElement.innerText;
    if (this.keyPressTimeout) {
      clearTimeout(this.keyPressTimeout);
    }
    this.inputState = InputState.WAITING;
    if (e.data === ' ') {
      this.processDiff();
    } else {
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
    if (this.keyPressTimeout) {
      clearTimeout(this.keyPressTimeout);
    }

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
    let spans = this.getSpans(diff, this.attempt);
    for (let span of spans) {
      this.addSpanToInput(span.displayText, span.class, span.tooltipText);
    }
    this.addSpanToInput('','');

    restorePosition();
  }

  getSpans(diff: WordChange[], attempt: string) {
    /* Converts the diff into a list of spans to display in the input element 
       This is done by building a list of spans, combining diffs when possible.
       For example, added and removed will be combined into a single span, and consecutive
       changed or added spans will be combined into a single span when possible. */
    const [normalizedText, normalizedTextMapping] = normalizeString(attempt);
    console.log(diff);
    let spans: DynamicSpan[] = [];
    let curSpan: DynamicSpan | null = null;
    let curIndex = 0;
    let originalStart = 0;
    let originalEnd = 0;
    for (let i = 0; i < diff.length; i++) {
      const change = diff[i];
      const [normalizedDiff, normalizedDiffMapping] = normalizeString(change.v.join(''));
      originalStart = normalizedTextMapping[curIndex];
      originalEnd = normalizedTextMapping[curIndex];
      let text = '';
      if (change.t != DiffType.REMOVED) {
        originalStart = normalizedTextMapping[curIndex];
        originalEnd = curIndex + normalizedDiff.length < normalizedTextMapping.length 
          ? normalizedTextMapping[curIndex + normalizedDiff.length ]
          : normalizedTextMapping[normalizedText.length - 1] + 1;
        curIndex += normalizedDiff.length;
        text = attempt.substring(originalStart, originalEnd);
      }

      switch (change.t) {
        case DiffType.ADDED:
          if (!curSpan || curSpan.class === SpanClass.UNCHANGED) {
            curSpan = new DynamicSpan();
            curSpan.startIndex = originalStart;
            curSpan.endIndex = originalEnd;
            curSpan.displayText = text;
            curSpan.tooltipText = '';
            curSpan.class = SpanClass.ADDED;
          } else {
            curSpan.endIndex = originalEnd;
            curSpan.displayText += text;
            if (curSpan.class === SpanClass.REMOVED) {
              curSpan.class = SpanClass.CHANGED;
            }
          }
          break;
        case DiffType.REMOVED:
          if (!curSpan || curSpan.class === SpanClass.UNCHANGED) {
            curSpan = new DynamicSpan();
            curSpan.startIndex = originalStart;
            curSpan.endIndex = originalEnd;
            curSpan.displayText = text;
            curSpan.tooltipText = change.v.join(' ');
            curSpan.class = SpanClass.REMOVED;
          } else {
            curSpan.endIndex = originalEnd;
            curSpan.displayText += text;
            curSpan.tooltipText += " " + change.v.join(' ');
            if (curSpan.class === SpanClass.ADDED) {
              curSpan.class = SpanClass.CHANGED;
            }
          }
          break;
        case DiffType.UNCHANGED:
          if (curSpan) {
            if (curSpan.class === SpanClass.REMOVED && spans.length > 0) {
              // We need to adjust the span to include the whitespace ending the previous span
              const prevSpan = spans[spans.length - 1];
              const match = prevSpan.displayText.match(/\s+$/);
              if (match) {
                const whitespace = match[0];
                const whitespaceIndex = prevSpan.displayText.length - whitespace.length;
                curSpan.displayText = prevSpan.displayText.substring(whitespaceIndex);
                curSpan.startIndex -= whitespace.length;
                prevSpan.displayText = prevSpan.displayText.substring(0, whitespaceIndex);
                prevSpan.endIndex -= whitespace.length;
              }
            }
            spans.push(curSpan);
            curSpan = null;
          }
          spans.push({
            startIndex: originalStart,
            endIndex: originalEnd,
            displayText: text,
            tooltipText: '',
            class: SpanClass.UNCHANGED
          });
          break;
      }
    }
    if (curSpan) {
      spans.push(curSpan);
    }
    if (originalEnd < attempt.length) {
      spans.push({
        startIndex: originalEnd,
        endIndex: attempt.length,
        displayText: attempt.substring(originalEnd),
        tooltipText: '',
        class: SpanClass.UNCHANGED
      });
    }
    return spans;
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
  }
} 