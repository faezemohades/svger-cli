import { Component, Input } from '@angular/core';

@Component({
  selector: 'test-icon',
  
  template: `
    <svg
      [attr.class]="className"
      [attr.width]="width"
      [attr.height]="height"
      [attr.fill]="fill"
      [attr.stroke]="stroke"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  `,
})
export class TestIconComponent {
  @Input() className: string = '';
  @Input() width: string | number = 24;
  @Input() height: string | number = 24;
  @Input() fill: string = 'currentColor';
  @Input() stroke: string = '';
}
