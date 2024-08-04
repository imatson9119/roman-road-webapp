import { BibleMetadata, BibleWord, Book, IBible, WordMap, AnchorType, DiffType, BibleDiff, BookDiff, ChapterDiff, VerseDiff, WordChange, BiblePointer } from './models';
import { BiblePassage } from './BiblePassage';
import { BibleIterator } from './BibleIterator';
import { BibleReference } from './BibleReference';
import { addToMapValue, cleanWhitespace, removeUnsanitaryItems, getWordChange, sanitizeText } from '../utils/utils';
import { diffWords } from 'diff';

export class Bible implements IBible {
  m: BibleMetadata;
  v: Book[];
  wordMap: WordMap;

  DEFAULT_ANCHOR_MAX_CERTAIN_LOCKS = 1; // The maximum number of certain locks before stopping the anchor search
  ANCHOR_SIGNIFICANCE_THRESHOLD = 100; // The maximum number of possible anchors to consider before the sequence is considered insignificant
  DEFAULT_ANCHOR_RETURN_NUMBER = 5; // The number of anchors to return
  MAX_LENGTH_DIFF_FACTOR = 4; // The maximum factor by which the length of the passage can differ from the length of the attempt

  constructor(bible: IBible, wordMap: WordMap) {
    this.m = bible.m;
    this.v = bible.v;
    this.wordMap = wordMap;
  }

  getWithoutIndex(bookIndex: number, chapterIndex: number, verseIndex: number): BiblePointer {
    if (bookIndex < 0 || bookIndex >= this.v.length) {
      throw new Error(`Invalid book index ${bookIndex} passed to getWithoutIndex`);
    }
    let book = this.v[bookIndex];
    if (chapterIndex < 0 || chapterIndex >= book.v.length) {
      throw new Error(`Invalid chapter index ${chapterIndex} passed to getWithoutIndex`);
    }
    let chapter = book.v[chapterIndex];
    if (verseIndex < 0 || verseIndex >= chapter.v.length) {
      throw new Error(`Invalid verse index ${verseIndex} passed to getWithoutIndex`);
    }
    let verse = chapter.v[verseIndex];
    return {
      index: verse.m.i,
      book: book,
      chapter: chapter,
      verse: verse,
    };
  }

  get(index: number): BibleWord {
    if (index < 0 || index >= this.m.l) {
      throw new Error('Invalid index');
    }
    for (let book of this.v) {
      if (index < book.m.i + book.m.l) {
        for (let chapter of book.v) {
          if (index < chapter.m.i + chapter.m.l) {
            for (let verse of chapter.v) {
              if (index < verse.m.i + verse.m.l) {
                return {
                  word: verse.v[index - verse.m.i],
                  index: index,
                  book: book,
                  chapter: chapter,
                  verse: verse,
                };
              }
            }
          }
        }
      }
    }
    throw new Error('Index not found');
  }

  getReference(index: number): BibleReference {
    let word = this.get(index);
    return new BibleReference(word.book.m.b, word.chapter.m.c, word.verse.m.v); 
  }

  getPassage(i: number, j: number): BiblePassage {
    if (i < 0 || j < 0 || i > j || i >= this.m.l) {
      throw new Error('Invalid indices');
    }
    let start = this.get(i);
    let end = this.get(j-1);
    return new BiblePassage(i, j, start.book, start.chapter, start.verse, end.book, end.chapter, end.verse);
  }

  getText(start_loc: number, end_loc: number): string {
    let bible: BibleIterator = new BibleIterator(this, start_loc, end_loc);
    let text = '';
    for (let word of bible) {
      text += word.word + ' ';
    }
    return text.trim();
  }

  anchorText(text: string, nAnchors: number = this.DEFAULT_ANCHOR_RETURN_NUMBER, maxCertainLocks: number = this.DEFAULT_ANCHOR_MAX_CERTAIN_LOCKS): [BiblePassage, number][] {
    let words =  text.trim().replace(/[^\w ]/g, "").toLowerCase().split(/\s+/);
    let startAnchors = this._getBibleAnchors(words, AnchorType.START, maxCertainLocks);
    let result: [BiblePassage, number][] = []
    if (startAnchors.length === 0) {
      return result;
    }
    let endAnchors = this._getBibleAnchors(words, AnchorType.END, maxCertainLocks);
    if (endAnchors.length === 0) {
      return result;
    }

    return this._getPassagesFromAnchors(startAnchors, endAnchors, words, nAnchors);
  }

  _getPassagesFromAnchors(startAnchors: [number, number][], endAnchors: [number, number][], words: string[], nAnchors: number): [BiblePassage, number][] {
    let result: [BiblePassage, number][] = [];
    for (let startAnchor of startAnchors) {
      for (let endAnchor of endAnchors) {
        if (this._isValidPassage(startAnchor[0], endAnchor[0], words.length)) {
          let passage = this.getPassage(startAnchor[0], endAnchor[0] + 1);
          let score = startAnchor[1] * endAnchor[1];
          result.push([passage, score]);
        }
      }
    }
    // console.log("Anchors:\n", result.sort((a, b) => b[1] - a[1]).slice(0, this.ANCHOR_RETURN_NUMBER));
    return result.sort((a, b) => b[1] - a[1]).slice(0, nAnchors);
  }

  _isValidPassage(start: number, end: number, attemptLength: number): boolean {
    return start <= end && end - start <= attemptLength * this.MAX_LENGTH_DIFF_FACTOR;
  }

  _getBibleAnchors(words: string[], type: AnchorType, maxCertainLocks: number): [number, number][]{
    /**
     * This function calculates likely starting or ending locations in the Bible for a given sequence of words.
     * An anchor sequence is a sequence that is used to locate a starting index in the Bible.
     *
     * @param words - An array of words for which to calculate anchor probabilities.
     * @param type - The type of anchor (start or end) to calculate probabilities for.
     *
     * @returns An array of tuples, where each tuple contains a sequence's potential starting or ending location in the Bible and its anchor probability.
     * The array is sorted in descending order of anchor probabilities.
     */
    let direction = type === AnchorType.START ? 1 : -1;
    let start = type === AnchorType.START ? 0 : words.length - 1;
    let nCertainLocks = 0;
    // List of anchor probabilities. Index i contains a list of probabilities for the anchor at index i
    // The format of the probabilities is [index, probability]
    let anchorProbabilities: [number, number][][] = []; 
    for (let i = start; i < words.length && i >= 0; i += direction) {
      if (this.wordMap[words[i]]) {
        anchorProbabilities.push(this._getBibleAnchorProbabilities(words, type, i));
        if (anchorProbabilities[anchorProbabilities.length - 1].length !== 0 && anchorProbabilities[anchorProbabilities.length - 1][0][1] === 1) {
          nCertainLocks++;
          if (nCertainLocks === maxCertainLocks) {
            break;
          }
        }
      }
    }
    // Combine and sort the anchor probabilities
    let combinedAnchorProbabilities: [number, number][] = [];
    for (let anchorProbability of anchorProbabilities) {
      combinedAnchorProbabilities = combinedAnchorProbabilities.concat(anchorProbability);
    }
    return combinedAnchorProbabilities.sort((a, b) => b[1] - a[1]);
  }


  _getBibleAnchorProbabilities(words: string[], type: AnchorType, start: number): [number, number][] {
    /**
     * This function calculates the probabilities of particular sequence being an anchor sequence.
     * An anchor sequence is a sequence that is used to locate a starting index in the Bible.
     *
     * @param words - An array of words for which to calculate anchor probabilities.
     * @param type - The type of anchor (start or end) to calculate probabilities for.
     * @param start - The index in the words array from which to start calculating probabilities.
     *
     * @returns A sorted array of tuples, where each tuple contains a sequence's potential starting or ending location in the Bible and its anchor probability.
     * The array is sorted in descending order of anchor probabilities.
     */

    let direction = type === AnchorType.START ? 1 : -1;
    let anchorProbabilities = new Map<number, number>(); 
    if(this.wordMap[words[start]]){
      let possibleAnchors = [...this.wordMap[words[start]]];
      for (let i = start + direction; i < words.length && i >= 0; i += direction) {
        let nextLocs = this.wordMap[words[i]] ? this.wordMap[words[i]] : new Set([]);
        let offset = Math.abs(i - start) * direction;
        let possibleAnchorsStartSize = possibleAnchors.length;
        let newPossibleAnchors = [...possibleAnchors].filter(x => {
          let shouldKeep = nextLocs.has(x + offset);
          if(!shouldKeep && possibleAnchorsStartSize <= this.ANCHOR_SIGNIFICANCE_THRESHOLD){
            addToMapValue(anchorProbabilities, x, 1 / possibleAnchorsStartSize);
          }
          return shouldKeep;
        });
        possibleAnchors = newPossibleAnchors;
        if (possibleAnchors.length === 0) {
          return [...anchorProbabilities.entries()].sort((a, b) => b[1] - a[1]);
        } else if(possibleAnchors.length === 1){
          break;
        }
      }
      if (possibleAnchors.length <= this.ANCHOR_SIGNIFICANCE_THRESHOLD){
        for (let loc of possibleAnchors) {
          addToMapValue(anchorProbabilities, loc, 1 / possibleAnchors.length);
        }
      }
    }
    return [...anchorProbabilities.entries()].sort((a, b) => b[1] - a[1]);
  }

  getFlatDiff(
    attempt: string,
    startLoc: number,
    endLoc: number,
    originalText: boolean = false
  ){
    if (startLoc < 0 || endLoc < 0 || startLoc > endLoc) {
      return undefined;
    }
    let scripture = this.getText(startLoc, endLoc);
    if (!scripture) {
      console.log('Error getting text');
      return undefined;
    }
    let flatDiff = getWordChange(
      diffWords(sanitizeText(scripture), sanitizeText(attempt), {
        ignoreCase: true,
        ignoreWhitespace: true,
      })
    );
    let scriptureArr = removeUnsanitaryItems(cleanWhitespace(scripture).split(' '));
    let attemptArr = removeUnsanitaryItems(cleanWhitespace(attempt).split(' '));
    let scriptureIndex = 0;
    let attemptIndex = 0;
    for (let diff of flatDiff){
      let diffType = diff.t;
      if (diffType === DiffType.ADDED){
        diff.v = attemptArr.slice(attemptIndex, attemptIndex + diff.v.length);
        attemptIndex += diff.v.length;
      } else if (diffType === DiffType.REMOVED){
        diff.v = scriptureArr.slice(scriptureIndex, scriptureIndex + diff.v.length);
        scriptureIndex += diff.v.length;
      } else {
        if (originalText){
          diff.v = attemptArr.slice(attemptIndex, attemptIndex + diff.v.length);
        } else {
          diff.v = scriptureArr.slice(scriptureIndex, scriptureIndex + diff.v.length);
        }
        attemptIndex += diff.v.length;
        scriptureIndex += diff.v.length;
      }
    }
    return flatDiff;
  }

  getBibleDiff(
    attempt: string,
    startLoc: number,
    endLoc: number
  ): BibleDiff | undefined {
    if (startLoc < 0 || endLoc < 0 || startLoc > endLoc) {
      return undefined;
    }
    let scripture = this.getText(startLoc, endLoc);
    if (!scripture) {
      console.log('Error getting text');
      return undefined;
    }
    let diff: WordChange[] = getWordChange(
      diffWords(sanitizeText(scripture), sanitizeText(attempt), {
        ignoreCase: true,
        ignoreWhitespace: true,
      })
    );
    // console.log(diff)
    let scriptureArr = removeUnsanitaryItems(cleanWhitespace(scripture).split(' '));
    let attemptArr = removeUnsanitaryItems(cleanWhitespace(attempt).split(' '));
    let scriptureIndex = 0;
    let attemptIndex = 0;
    let diffIndex = 0;
    let changeIndex = 0;
    let curLoc = startLoc;
    let done = false;
    let bibleDiff: BibleDiff = {
      m: this.m,
      p: this.getPassage(startLoc, endLoc).toString() || '',
      i: startLoc,
      j: endLoc,
      v: [],
    };

    for (let book of this.v) {
      if (curLoc < book.m.i + book.m.l && !done) {
        let bookDiff: BookDiff = {
          m: book.m,
          v: [],
        };
        for (let chapter of book.v) {
          if (curLoc < chapter.m.i + chapter.m.l && !done) {
            let chapterDiff: ChapterDiff = {
              m: chapter.m,
              v: [],
            };
            for (let verse of chapter.v) {
              if (curLoc < verse.m.i + verse.m.l && !done) {
                let verseDiff: VerseDiff = {
                  m: verse.m,
                  v: [],
                };
                while (
                  curLoc < verse.m.i + verse.m.l &&
                  diffIndex < diff.length &&
                  changeIndex < diff[diffIndex].v.length
                ) {
                  let diffType = diff[diffIndex].t;
                  if (
                    verseDiff.v.length == 0 ||
                    diffType != verseDiff.v[verseDiff.v.length - 1].t
                  ) {
                    verseDiff.v.push({
                      t: diffType,
                      v: [],
                      i: curLoc,
                    });
                  }
                  if (diffType == DiffType.ADDED) {
                    verseDiff.v[verseDiff.v.length - 1].v.push(
                      attemptArr[attemptIndex]
                    );
                    attemptIndex += 1;
                  } else if (diffType == DiffType.REMOVED) {
                    verseDiff.v[verseDiff.v.length - 1].v.push(
                      scriptureArr[scriptureIndex]
                    );
                    scriptureIndex += 1;
                    curLoc += 1;
                  } else {
                    verseDiff.v[verseDiff.v.length - 1].v.push(
                      scriptureArr[scriptureIndex]
                    );
                    attemptIndex += 1;
                    scriptureIndex += 1;
                    curLoc += 1;
                  }
                  changeIndex += 1;
                  if (changeIndex == diff[diffIndex].v.length) {
                    changeIndex = 0;
                    diffIndex += 1;
                  }
                  if (diffIndex == diff.length) {
                    done = true;
                    break;
                  }
                }
                chapterDiff.v.push(verseDiff);
              }
            }
            bookDiff.v.push(chapterDiff);
          }
        }
        bibleDiff.v.push(bookDiff);
      }
    }
    return bibleDiff;
  }

}
