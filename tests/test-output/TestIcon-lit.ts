import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('test-icon')
export class TestIcon extends LitElement {
  @property({ type: String }) className = '';
  @property({ type: String, reflect: true }) width = '24';
  @property({ type: String, reflect: true }) height = '24';
  @property({ type: String, reflect: true }) fill = 'currentColor';
  @property({ type: String, reflect: true }) stroke = '';

  static styles = css`:host { display: inline-block; }`;

  render() {
    return svg`
      <svg
        class="${this.className}"
        width="${this.width}"
        height="${this.height}"
        fill="${this.fill}"
        stroke="${this.stroke}"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-icon': TestIcon;
  }
}
