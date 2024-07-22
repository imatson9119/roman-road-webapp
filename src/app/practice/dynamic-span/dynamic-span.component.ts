import { Component, ElementRef, Input, Renderer2, ViewChild, ViewContainerRef } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-dynamic-span',
  standalone: true,
  imports: [MatTooltipModule],
  template: `<span [class]='class' [matTooltip]='tooltipText'>{{displayText}}</span>`,
  styleUrl: './dynamic-span.component.scss'
})
export class DynamicSpanComponent {
  @Input() tooltipText: string = '';
  @Input() displayText: string = '';
  @Input() class: string = '';
  
}
