import { Change } from "diff";
import { DiffType, IResult, WordChange } from "../classes/models";


const bookAbbreviations: { [key: string]: string } = {
  "genesis": "Gen",
  "exodus": "Exo",
  "leviticus": "Lev",
  "numbers": "Num",
  "deuteronomy": "Deu",
  "joshua": "Jos",
  "judges": "Jdg",
  "ruth": "Rth",
  "1 samuel": "1Sa",
  "i samuel": "1Sa",
  "2 samuel": "2Sa",
  "ii samuel": "2Sa",
  "1 kings": "1Ki",
  "i kings": "1Ki",
  "2 kings": "2Ki",
  "ii kings": "2Ki",
  "1 chronicles": "1Ch",
  "i chronicles": "1Ch",
  "2 chronicles": "2Ch",
  "ii chronicles": "2Ch",
  "ezra": "Eza",
  "nehemiah": "Neh",
  "esther": "Est",
  "job": "Job",
  "psalms": "Psa",
  "proverbs": "Pro",
  "ecclesiastes": "Ecc",
  "song of solomon": "SS",
  "song of songs": "SS",
  "isaiah": "Isa",
  "jeremiah": "Jer",
  "lamentations": "Lam",
  "ezekiel": "Ezk",
  "daniel": "Dan",
  "hosea": "Hos",
  "joel": "Joe",
  "amos": "Amo",
  "obadiah": "Obd",
  "jonah": "Jon",
  "micah": "Mic",
  "nahum": "Nah",
  "habakkuk": "Hab",
  "zephaniah": "Zep",
  "haggai": "Hag",
  "zechariah": "Zch",
  "malachi": "Mal",
  "matthew": "Mat",
  "mark": "Mrk",
  "luke": "Luk",
  "john": "Jn",
  "acts": "Act",
  "acts of the apostles": "Act",
  "romans": "Rom",
  "1 corinthians": "1Co",
  "i corinthians": "1Co",
  "2 corinthians": "2Co",
  "ii corinthians": "2Co",
  "galatians": "Gal",
  "ephesians": "Eph",
  "philippians": "Php",
  "colossians": "Col",
  "1 thessalonians": "1Th",
  "i thessalonians": "1Th",
  "2 thessalonians": "2Th",
  "ii thessalonians": "2Th",
  "1 timothy": "1Ti",
  "i timothy": "1Ti",
  "2 timothy": "2Ti",
  "ii timothy": "2Ti",
  "titus": "Tit",
  "philemon": "Phm",
  "hebrews": "Heb",
  "james": "Jam",
  "1 peter": "1Pe",
  "i peter": "1Pe",
  "2 peter": "2Pe",
  "ii peter": "2Pe",
  "1 john": "1Jo",
  "i john": "1Jo",
  "2 john": "2Jo",
  "ii john": "2Jo",
  "3 john": "3Jo",
  "iii john": "3Jo",
  "jude": "Jud",
  "revelation": "Rev",
}

export function sanitizeText(text: string): string{
  return cleanWhitespace(text.replace(/[^\w\s]/g, "").toLowerCase());
}

export function removeUnsanitaryItems(arr: string[]): string[] {
  let ret: string[] = []

  for (let item of arr) {
    if (sanitizeText(item).length > 0){
      ret.push(item);
    } else {
      if (ret.length > 0) {
        ret[ret.length - 1] = ret[ret.length - 1] + ` ${item} `;
      }
    }
  }
  
  return ret;
}

export function cleanWhitespace(text: string): string{
  return text.split(/\s+/).join(" ").trim();
}

export function addToMapValue<T>(map: Map<T,number>, key: T, value: number): void {
  if (map.has(key)){
    map.set(key, map.get(key) as number + value);
  } else {
    map.set(key, value);
  }
}

export function createReference(names: string[], start: number, end: number) {
  let reference = names[0] + " " + names[1] + ":" + names[2];
  if (start === 2){
    return names[2];
  }
  if (end === 0) {
    return names[0]
  }
  if (start === 1){
    reference = reference.split(" ")[1];
  }
  if (end === 1){
    reference = reference.split(":")[0];
  }
  return reference;
}

export function getWordChange(diff: Change[]): WordChange[] {
  let wordChanges: WordChange[] = [];
  for (let change of diff){
    let added = Object.hasOwn(change, "added") && change.added !== undefined;
    let removed = Object.hasOwn(change, "removed") && change.removed !== undefined;
    let type: DiffType = added ? DiffType.ADDED : removed ? DiffType.REMOVED : DiffType.UNCHANGED;
    let sanitizedText = sanitizeText(change.value);
    if (sanitizedText === ""){
      continue;
    }
    wordChanges.push({
      "t": type,
      "v": sanitizedText.split(" "),
    });
  }
  return wordChanges;
}

export function getRelativeDate(dateParam: string | Date | number | null): string | null {
  if (!dateParam) {
    return null;
  }

  const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam);
  const today = new Date();
  const seconds = Math.round((today.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const months = Math.round(days / 30);

  if (seconds < 60) {
    return seconds === 1 ? '1 second ago' : `${seconds} seconds ago`;
  } else if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  } else if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  } else if (days < 7) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

export function abbreviateBookName(bookName: string): string {
  return bookAbbreviations[bookName.toLowerCase()] || bookName;
}

export function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1/3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

export function numberToColorHsl(i: number, saturation = .4, lightness = .8) {
  i = (1 - i) * 100;
  // as the function expects a value between 0 and 1, and red = 0° and green = 120°
  // we convert the input to the appropriate hue value
  var hue = i * 1.2 / 360;
  // we convert hsl to rgb (saturation 100%, lightness 50%)
  var rgb = hslToRgb(hue, saturation, lightness);
  // we format to css value and return
  return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; 
}

export function replacer(key: any, value: any) {
  if(value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else if (value instanceof Set){
    return {
      dataType: 'Set',
      value: Array.from(value.values())
    }
  } else {
    return value;
  }
}

export function reviver(key: any, value: any) {
  if(typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
    if (value.dataType === 'Set') {
      return new Set(value.value);
    }
  }
  return value;
}

export function intersection(start1: number, end1: number, start2: number, end2: number): boolean {
  return start1 <= (end2-1) && start2 <= (end1-1);
}

export function getAttemptText(result: IResult): string {
  let build = '';
  for (let bookDiff of result.diff.v) {
    for (let chapterDiff of bookDiff.v) {
      for (let verseDiff of chapterDiff.v) {
        for (let wordDiff of verseDiff.v) {
          if (wordDiff.t === DiffType.ADDED || wordDiff.t === DiffType.UNCHANGED) {
            build += wordDiff.v.join(' ') + ' ';
          }
        }
      }
    }
  }
  return build.trim();
}

export function saveCaretPosition(context: any){
  var selection = window.getSelection();
  var range = selection!.getRangeAt(0);
  range.setStart(  context, 0 );
  var len = range.toString().length;

  return function restore(){
      var pos = getTextNodeAtPosition(context, len);
      selection!.removeAllRanges();
      var range = new Range();
      range.setStart(pos.node ,pos.position);
      selection!.addRange(range);

  }
}

export function getTextNodeAtPosition(root: any, index: any){
  const NODE_TYPE = NodeFilter.SHOW_TEXT;
  var treeWalker = document.createTreeWalker(root, NODE_TYPE, function next(elem) {
      if(index > elem.textContent!.length){
          index -= elem.textContent!.length;
          return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT;
  });
  var c = treeWalker.nextNode();
  return {
      node: c? c: root,
      position: c? Math.min(index,c!.textContent!.length) : Math.min(index,root.textContent!.length)
  };
}

export function normalizeString(str: string): [string, number[]]{
  /* Normalize string to remove all non-alphanumeric characters and convert to lowercase 
     Returns the normalized string and a mapping from the normalized string to the original string */
  let normalized = "";
  let mapping: number[] = [];
  for (let i = 0; i < str.length; i++){
    if (str[i].match(/[a-z0-9]/i)){
      normalized += str[i].toLowerCase();
      mapping.push(i);
    }
  }
  return [normalized, mapping];
}

export const quickColor: any = {0:"rgb(184,224,184)",1:"rgb(224,184,184)",0.01:"rgb(184,224,184)",0.02:"rgb(185,224,184)",0.03:"rgb(186,224,184)",0.04:"rgb(187,224,184)",0.05:"rgb(188,224,184)",0.06:"rgb(188,224,184)",0.07:"rgb(189,224,184)",0.08:"rgb(190,224,184)",0.09:"rgb(191,224,184)",0.1:"rgb(192,224,184)",0.11:"rgb(193,224,184)",0.12:"rgb(193,224,184)",0.13:"rgb(194,224,184)",0.14:"rgb(195,224,184)",0.15:"rgb(196,224,184)",0.16:"rgb(197,224,184)",0.17:"rgb(197,224,184)",0.18:"rgb(198,224,184)",0.19:"rgb(199,224,184)",0.2:"rgb(200,224,184)",0.21:"rgb(201,224,184)",0.22:"rgb(202,224,184)",0.23:"rgb(202,224,184)",0.24:"rgb(203,224,184)",0.25:"rgb(204,224,184)",0.26:"rgb(205,224,184)",0.27:"rgb(206,224,184)",0.28:"rgb(206,224,184)",0.29:"rgb(207,224,184)",0.3:"rgb(208,224,184)",0.31:"rgb(209,224,184)",0.32:"rgb(210,224,184)",0.33:"rgb(211,224,184)",0.34:"rgb(211,224,184)",0.35:"rgb(212,224,184)",0.36:"rgb(213,224,184)",0.37:"rgb(214,224,184)",0.38:"rgb(215,224,184)",0.39:"rgb(215,224,184)",0.4:"rgb(216,224,184)",0.41:"rgb(217,224,184)",0.42:"rgb(218,224,184)",0.43:"rgb(219,224,184)",0.44:"rgb(220,224,184)",0.45:"rgb(220,224,184)",0.46:"rgb(221,224,184)",0.47:"rgb(222,224,184)",0.48:"rgb(223,224,184)",0.49:"rgb(224,224,184)",0.5:"rgb(224,224,184)",0.51:"rgb(224,224,184)",0.52:"rgb(224,223,184)",0.53:"rgb(224,222,184)",0.54:"rgb(224,221,184)",0.55:"rgb(224,220,184)",0.56:"rgb(224,220,184)",0.57:"rgb(224,219,184)",0.58:"rgb(224,218,184)",0.59:"rgb(224,217,184)",0.6:"rgb(224,216,184)",0.61:"rgb(224,215,184)",0.62:"rgb(224,215,184)",0.63:"rgb(224,214,184)",0.64:"rgb(224,213,184)",0.65:"rgb(224,212,184)",0.66:"rgb(224,211,184)",0.67:"rgb(224,211,184)",0.68:"rgb(224,210,184)",0.69:"rgb(224,209,184)",0.7:"rgb(224,208,184)",0.71:"rgb(224,207,184)",0.72:"rgb(224,206,184)",0.73:"rgb(224,206,184)",0.74:"rgb(224,205,184)",0.75:"rgb(224,204,184)",0.76:"rgb(224,203,184)",0.77:"rgb(224,202,184)",0.78:"rgb(224,202,184)",0.79:"rgb(224,201,184)",0.8:"rgb(224,200,184)",0.81:"rgb(224,199,184)",0.82:"rgb(224,198,184)",0.83:"rgb(224,197,184)",0.84:"rgb(224,197,184)",0.85:"rgb(224,196,184)",0.86:"rgb(224,195,184)",0.87:"rgb(224,194,184)",0.88:"rgb(224,193,184)",0.89:"rgb(224,193,184)",0.9:"rgb(224,192,184)",0.91:"rgb(224,191,184)",0.92:"rgb(224,190,184)",0.93:"rgb(224,189,184)",0.94:"rgb(224,188,184)",0.95:"rgb(224,188,184)",0.96:"rgb(224,187,184)",0.97:"rgb(224,186,184)",0.98:"rgb(224,185,184)",0.99:"rgb(224,184,184)"}