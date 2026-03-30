(function (global, factory) {
  if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
    module.exports = factory();
  } else {
    global.FluidContainer = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  'use strict';

  class CurveElement extends HTMLElement {
    static get observedAttributes() {
      return ['equation', 'svg-path', 'width', 'height', 'color', 'precision', 'curve-type', 'overflow'];
    }

    constructor() {
      super();
      this.equation = "0.03*(x-5)**3 + 5";
      this.svgPath = "";
      this.width = 300;
      this.height = 200;
      this.color = "#3498db";
      this.precision = 20;
      this.curveType = "cartesian";
      this.overflow = "hidden";
      this.inputMethod = "equation";

      this.attachShadow({ mode: 'open' });

      this.container = document.createElement('div');
      this.container.style.width = `${this.width}px`;
      this.container.style.height = `${this.height}px`;
      this.container.style.position = 'relative';
      this.container.style.overflow = 'hidden';

      this.svgContainer = document.createElement('div');
      this.svgContainer.className = 'svg-container';
      this.container.appendChild(this.svgContainer);

      this.contentContainer = document.createElement('div');
      this.contentContainer.style.position = 'absolute';
      this.contentContainer.style.top = '0';
      this.contentContainer.style.left = '0';
      this.contentContainer.style.width = '100%';
      this.contentContainer.style.height = '100%';

      const slot = document.createElement('slot');
      this.contentContainer.appendChild(slot);
      this.container.appendChild(this.contentContainer);

      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; contain: content; }
        .svg-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
        ::slotted(*) { box-sizing: border-box; }
      `;

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(this.container);
    }

    connectedCallback() {
      if (this.hasAttribute('equation')) { this.equation = this.getAttribute('equation'); this.inputMethod = "equation"; }
      if (this.hasAttribute('svg-path')) { this.svgPath = this.getAttribute('svg-path'); this.inputMethod = "svg-path"; }
      if (this.hasAttribute('width')) { this.width = parseInt(this.getAttribute('width')); this.container.style.width = `${this.width}px`; }
      if (this.hasAttribute('height')) { this.height = parseInt(this.getAttribute('height')); this.container.style.height = `${this.height}px`; }
      if (this.hasAttribute('color')) { this.color = this.getAttribute('color'); }
      if (this.hasAttribute('precision')) { this.precision = parseInt(this.getAttribute('precision')); }
      if (this.hasAttribute('curve-type')) { this.curveType = this.getAttribute('curve-type'); }
      if (this.hasAttribute('overflow')) { this.overflow = this.getAttribute('overflow'); this.applyOverflowStyle(); }
      this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      switch (name) {
        case 'equation': this.equation = newValue; this.inputMethod = "equation"; break;
        case 'svg-path': this.svgPath = newValue; this.inputMethod = "svg-path"; break;
        case 'width': this.width = parseInt(newValue); this.container.style.width = `${this.width}px`; break;
        case 'height': this.height = parseInt(newValue); this.container.style.height = `${this.height}px`; break;
        case 'color': this.color = newValue; break;
        case 'precision': this.precision = parseInt(newValue); break;
        case 'curve-type': this.curveType = newValue; break;
        case 'overflow': this.overflow = newValue; this.applyOverflowStyle(); break;
      }
      this.render();
    }

    applyOverflowStyle() {
      if (this.contentContainer) {
        this.contentContainer.style.overflow = this.overflow;
        if (this.overflow === 'hidden') {
          this.contentContainer.style.clipPath = `url(#clip-${this.id || 'curve'})`;
        } else {
          this.contentContainer.style.clipPath = '';
        }
      }
    }

    parsePathData(pathData) {
      const commands = pathData.split(/(?=[A-Za-z])/).filter(cmd => cmd.trim() !== '');
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let currentX = 0, currentY = 0;

      for (const cmd of commands) {
        const command = cmd[0];
        const points = cmd.slice(1).trim().split(/[\s,]+/).filter(p => p !== '').map(parseFloat);

        switch (command) {
          case 'M':
          case 'L':
            if (points.length >= 2) {
              currentX = points[0];
              currentY = points[1];
              this.updateBounds(currentX, currentY, minX, minY, maxX, maxY);
            }
            break;
          case 'H':
            if (points.length >= 1) {
              currentX = points[0];
              this.updateBounds(currentX, currentY, minX, minY, maxX, maxY);
            }
            break;
          case 'V':
            if (points.length >= 1) {
              currentY = points[0];
              this.updateBounds(currentX, currentY, minX, minY, maxX, maxY);
            }
            break;
          case 'C':
            if (points.length >= 6) {
              currentX = points[4];
              currentY = points[5];
              this.updateBounds(currentX, currentY, minX, minY, maxX, maxY);
              this.updateBounds(points[0], points[1], minX, minY, maxX, maxY);
              this.updateBounds(points[2], points[3], minX, minY, maxX, maxY);
            }
            break;
          case 'Q':
            if (points.length >= 4) {
              currentX = points[2];
              currentY = points[3];
              this.updateBounds(currentX, currentY, minX, minY, maxX, maxY);
              this.updateBounds(points[0], points[1], minX, minY, maxX, maxY);
            }
            break;
          case 'A':
            if (points.length >= 7) {
              currentX = points[5];
              currentY = points[6];
              this.updateBounds(currentX, currentY, minX, minY, maxX, maxY);
            }
            break;
          case 'Z':
          case 'z':
            break;
        }
      }

      return {
        minX: minX === Infinity ? 0 : minX,
        minY: minY === Infinity ? 0 : minY,
        maxX: maxX === -Infinity ? 100 : maxX,
        maxY: maxY === -Infinity ? 100 : maxY,
        width: (maxX === -Infinity ? 100 : maxX) - (minX === Infinity ? 0 : minX),
        height: (maxY === -Infinity ? 100 : maxY) - (minY === Infinity ? 0 : minY)
      };
    }

    updateBounds(x, y, minX, minY, maxX, maxY) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return [minX, minY, maxX, maxY];
    }

    scaleSvgPath(pathData, width, height) {
      if (!pathData) return pathData;
      const bounds = this.parsePathData(pathData);
      const pathWidth = bounds.width || 100;
      const pathHeight = bounds.height || 100;
      const scaleX = width / pathWidth;
      const scaleY = height / pathHeight;
      const scale = Math.min(scaleX, scaleY);
      const translateX = -bounds.minX + (width - pathWidth * scale) / (2 * scale);
      const translateY = -bounds.minY + (height - pathHeight * scale) / (2 * scale);
      return pathData;
    }

    render() {
      let pathData;
      let transform = "";

      if (this.inputMethod === "svg-path" && this.svgPath) {
        pathData = this.svgPath;
        const bounds = this.parsePathData(pathData);
        const pathWidth = bounds.width || 100;
        const pathHeight = bounds.height || 100;
        const scaleX = this.width / pathWidth;
        const scaleY = this.height / pathHeight;
        const scale = Math.min(scaleX, scaleY) * 0.9;
        const translateX = -bounds.minX + (this.width - pathWidth * scale) / (2 * scale);
        const translateY = -bounds.minY + (this.height - pathHeight * scale) / (2 * scale);
        transform = `translate(${translateX}, ${translateY}) scale(${scale})`;
      } else {
        const points = this.generatePoints(this.equation, this.width, this.height, this.precision);
        pathData = this.createPathData(points, this.width, this.height);
      }

      this.svgContainer.innerHTML = '';
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", this.width);
      svg.setAttribute("height", this.height);
      svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);

      if (this.overflow === 'hidden') {
        const clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
        clipPath.setAttribute("id", `clip-${this.id || 'curve'}`);
        const clipPathShape = document.createElementNS("http://www.w3.org/2000/svg", "path");
        clipPathShape.setAttribute("d", pathData);
        if (transform) {
          clipPathShape.setAttribute("transform", transform);
        }
        clipPath.appendChild(clipPathShape);
        svg.appendChild(clipPath);
      }

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill", this.color);
      path.setAttribute("stroke", this.darkenColor(this.color, 20));
      path.setAttribute("stroke-width", "2");
      if (transform) {
        path.setAttribute("transform", transform);
      }
      svg.appendChild(path);
      this.svgContainer.appendChild(svg);
      this.applyOverflowStyle();
    }

    generatePoints(equation, width, height, precision) {
      const points = [];
      const xValues = [];
      const step = width / precision;
      for (let x = 0; x <= width; x += step) {
        xValues.push(x);
      }
      if (xValues[xValues.length - 1] < width) {
        xValues.push(width);
      }
      for (const x of xValues) {
        try {
          const normalizedX = (x / width) * 10;
          let y;
          if (this.curveType === "sin") {
            y = this.evaluateSinEquation(equation, normalizedX, height);
          } else if (this.curveType === "cos") {
            y = this.evaluateCosEquation(equation, normalizedX, height);
          } else if (this.curveType === "circle") {
            y = this.evaluateCircleEquation(equation, normalizedX, height, x, width);
          } else if (this.curveType === "polar") {
            y = this.evaluatePolarEquation(equation, normalizedX, height, x, width);
          } else if (this.curveType === "parametric") {
            y = this.evaluateParametricEquation(equation, normalizedX, height, x, width);
          } else {
            y = this.evaluateEquation(equation, normalizedX, height);
          }
          const yCoord = height - y;
          points.push({x, y: yCoord});
        } catch (e) {
          console.error(`Error evaluating equation at x=${x}: ${e}`);
          points.push({x, y: height / 2});
        }
      }
      return points;
    }

    createPathData(points, width, height) {
      if (points.length === 0) return "";
      let pathData = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathData += ` L ${points[i].x} ${points[i].y}`;
      }
      pathData += ` L ${width} ${height} L 0 ${height} Z`;
      return pathData;
    }

    evaluateEquation(equation, x, height) {
      try {
        const func = new Function('x', `return ${equation};`);
        let result = func(x);
        result = result * (height / 10);
        if (result > height) { result = height; }
        else if (result < 0) { result = 0; }
        return result;
      } catch (e) {
        console.error(`Error evaluating equation: ${e}`);
        return height / 2;
      }
    }

    evaluateSinEquation(equation, x, height) {
      try {
        const parts = equation.split('*');
        const amplitude = parts.length > 0 ? eval(parts[0]) : 1;
        const frequency = parts.length > 2 ? eval(parts[2].split(')')[0].replace('Math.sin(', '')) : 1;
        const value = amplitude * Math.sin(frequency * x);
        return (value + amplitude) * (height / (2 * amplitude));
      } catch (e) {
        console.error(`Error evaluating sine equation: ${e}`);
        return height / 2;
      }
    }

    evaluateCosEquation(equation, x, height) {
      try {
        const parts = equation.split('*');
        const amplitude = parts.length > 0 ? eval(parts[0]) : 1;
        const frequency = parts.length > 2 ? eval(parts[2].split(')')[0].replace('Math.cos(', '')) : 1;
        const value = amplitude * Math.cos(frequency * x);
        return (value + amplitude) * (height / (2 * amplitude));
      } catch (e) {
        console.error(`Error evaluating cosine equation: ${e}`);
        return height / 2;
      }
    }

    evaluateCircleEquation(equation, x, height, origX, width) {
      try {
        const center = width / 2;
        const radius = Math.min(width, height) / 2;
        const xRelative = origX - center;
        const y = Math.sqrt(Math.max(0, radius * radius - xRelative * xRelative));
        return center - y + (height - width) / 2;
      } catch (e) {
        console.error(`Error evaluating circle equation: ${e}`);
        return height / 2;
      }
    }

    evaluatePolarEquation(equation, theta, height, x, width) {
      try {
        const r = this.evaluateEquation(equation, theta, height);
        const centerY = height / 2;
        const yCoord = r * Math.sin(theta);
        return centerY - yCoord * (height / 20);
      } catch (e) {
        console.error(`Error evaluating polar equation: ${e}`);
        return height / 2;
      }
    }

    evaluateParametricEquation(equation, t, height, x, width) {
      try {
        const [xExpr, yExpr] = equation.split(',');
        const xFunc = new Function('t', `return ${xExpr};`);
        const yFunc = new Function('t', `return ${yExpr};`);
        let yVal = yFunc(t);
        yVal = yVal * (height / 10);
        if (yVal > height) { yVal = height; }
        else if (yVal < 0) { yVal = 0; }
        return yVal;
      } catch (e) {
        console.error(`Error evaluating parametric equation: ${e}`);
        return height / 2;
      }
    }

    darkenColor(color, percent) {
      const num = parseInt(color.slice(1), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) - amt;
      const G = (num >> 8 & 0x00FF) - amt;
      const B = (num & 0x0000FF) - amt;
      return `#${(0x1000000 +
        (R < 0 ? 0 : R) * 0x10000 +
        (G < 0 ? 0 : G) * 0x100 +
        (B < 0 ? 0 : B)).toString(16).slice(1)}`;
    }
  }

  if (!customElements.get('curve-element')) {
    customElements.define('curve-element', CurveElement);
  }

  return { CurveElement };
});
