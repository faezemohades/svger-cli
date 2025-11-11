import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'check-mark',
  standalone: true,
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
      <circle cx="12" cy="12" r="10"/>
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckMarkComponent {
  @Input() className: string = '';
  @Input() width: string | number = 24;
  @Input() height: string | number = 24;
  @Input() fill: string = 'currentColor';
  @Input() stroke: string = '';
}
