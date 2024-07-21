import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { InputComponent } from './input/input.component';
import { StorageService } from './services/storage.service';
import { FormsModule } from '@angular/forms';
import { SingleAttemptComponent } from './results/single-attempt/single-attempt.component';
import { HeatmapComponent } from './results/heatmap/heatmap.component';
import { BibleService } from './services/bible.service';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { PassageSelectDialogComponent } from './passage-select-dialog.component/passage-select-dialog.component';
import { HistoryComponent } from './results/history/history.component';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSortModule } from '@angular/material/sort';
import { DeleteAttemptDialogComponent } from './results/single-attempt/delete-attempt-dialog/delete-attempt-dialog.component';
import { DiffDisplayComponent } from './results/diff-display/diff-display.component';
import { BibleDisplayComponent } from './results/bible-display/bible-display.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatRippleModule } from '@angular/material/core';
import { InfoComponent } from './info/info.component';
import { ImportDialogComponent } from './results/history/import-dialog/import-dialog.component';
import { FileUploadComponent } from './results/history/file-upload/file-upload.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FileDropDirective } from './utils/file-drop.directive';
import { VerseSelectorComponent } from './verse-selector/verse-selector.component';
import { VerseSelectorPopupComponent } from './verse-selector/verse-selector-popup/verse-selector-popup.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { HomeComponent } from './home/home.component';
import { DeleteGoalDialogComponent } from './goal/delete-goal-dialog/delete-goal-dialog.component';
import { HttpClientModule } from '@angular/common/http';
import { GoalComponent } from './goal/goal.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { DonatePopupComponent } from './info/donate-popup/donate-popup.component';
import { PracticeComponent } from './practice/practice.component';

@NgModule({
  declarations: [
    AppComponent,
    InputComponent,
    SingleAttemptComponent,
    HeatmapComponent,
    PassageSelectDialogComponent,
    HistoryComponent,
    DeleteAttemptDialogComponent,
    DiffDisplayComponent,
    BibleDisplayComponent,
    InfoComponent,
    ImportDialogComponent,
    FileUploadComponent,
    FileDropDirective,
    VerseSelectorComponent,
    VerseSelectorPopupComponent,
    HomeComponent,
    DeleteGoalDialogComponent,
    GoalComponent,
    DonatePopupComponent,
    PracticeComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    BrowserAnimationsModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatSelectModule,
    MatIconModule,
    MatToolbarModule,
    MatMenuModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSortModule,
    MatSnackBarModule,
    MatRippleModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    HttpClientModule,
    MatProgressSpinnerModule,
    BaseChartDirective
  ],
  providers: [StorageService, BibleService, provideCharts(withDefaultRegisterables())],
  bootstrap: [AppComponent],
})
export class AppModule {}
