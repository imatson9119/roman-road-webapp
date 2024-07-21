import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
})
export class FileUploadComponent {
  @Input()
  requiredFileType: string = 'json';

  isHovered: boolean = false;
  fileName = '';
  files: File[] = [];

  constructor() {}

  onFileSelected(event: any) {
    const files: File[] = event.target.files;
    if (files) {
      let s = Array.from(files);
      this.selectFiles(s);
    }
  }

  selectFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }
    let nFiles = files.length;
    if (nFiles > 1) {
      this.fileName = `${nFiles} files`;
    } else {
      this.fileName = files[0].name;
    }
    this.files = files;
  }

  getFiles(): File[] {
    return this.files;
  }

  onFilesDropped(event: any) {
    let files: FileList = event;
    // Remove anything that isn't json
    let nFiles = files.length;
    let validFiles: File[] = [];
    for (let i = 0; i < nFiles; i++) {
      let file = files[i];
      if (file.name.endsWith('.json')) {
        validFiles.push(file);
      }
    }
    this.selectFiles(validFiles);
  }

  onFilesHovered(event: boolean) {
    this.isHovered = event;
  }
}
