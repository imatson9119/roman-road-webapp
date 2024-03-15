import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { InputComponent } from './input/input.component';
import { StorageService } from './services/storage.service';
import { ResultsComponent } from './results/results.component';
import { NavbarComponent } from './navbar/navbar.component';
import { FormsModule } from '@angular/forms';
import { SingleAttemptComponent } from './results/single-attempt/single-attempt.component';
import { HeatmapComponent } from './results/heatmap/heatmap.component';
import { BibleService } from './services/bible.service';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatDialogModule} from '@angular/material/dialog';

@NgModule({
  declarations: [
    AppComponent,
    InputComponent,
    ResultsComponent,
    NavbarComponent,
    SingleAttemptComponent,
    HeatmapComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    BrowserAnimationsModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule
  ],
  providers: [StorageService, BibleService],
  bootstrap: [AppComponent]
})
export class AppModule { }
