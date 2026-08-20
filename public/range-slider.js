// Two-handle range filter, in the shape Qasa uses for rent and size.
//
// Built from two overlaid <input type="range"> rather than divs and pointer
// maths, so it is keyboard-operable and screen readers get real values for
// free. The top handle is whichever one the pointer is nearer, which is what
// stops the two sticking together at the ends.
//
// The maximum is open-ended: at the top of the track the filter means "no upper
// limit", not "exactly this". A GTO flight at 35,786 km should still appear
// when the altitude slider is pushed to its end.
(function () {
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /**
   * host   — container to fill
   * opts   — { min, max, step, value: [lo, hi], format, onChange }
   * Returns { get: () => [lo, hi | null], reset() }.  hi is null when open-ended.
   */
  window.rangeSlider = function rangeSlider(host, opts) {
    const { min, max, step = 1, format = String, onChange } = opts;
    let [lo, hi] = opts.value ?? [min, max];

    host.textContent = '';
    host.classList.add('range');

    const readout = el('div', 'range-readout');
    const track = el('div', 'range-track');
    const fill = el('div', 'range-fill');
    track.append(fill);

    const inputs = [0, 1].map(i => {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = i === 0 ? lo : hi;
      input.className = 'range-input';
      input.setAttribute('aria-label', i === 0 ? 'Minimum' : 'Maximum');
      return input;
    });

    const pct = v => ((v - min) / (max - min)) * 100;

    function paint() {
      fill.style.left = pct(lo) + '%';
      fill.style.width = (pct(hi) - pct(lo)) + '%';
      // the top of the track reads as open-ended, so say so rather than a number
      readout.textContent = `${format(lo)} – ${hi >= max ? format(max) + '+' : format(hi)}`;
      inputs[0].value = lo;
      inputs[1].value = hi;
      // whichever handle is higher in the stack must be the one nearer the click
      inputs[0].style.zIndex = lo > max - (max - min) * 0.1 ? 4 : 3;
    }

    inputs[0].addEventListener('input', () => {
      lo = Math.min(Number(inputs[0].value), hi - step);
      paint();
    });
    inputs[1].addEventListener('input', () => {
      hi = Math.max(Number(inputs[1].value), lo + step);
      paint();
    });
    for (const input of inputs) {
      input.addEventListener('change', () => onChange?.(lo, hi >= max ? null : hi));
    }

    host.append(readout, track, inputs[0], inputs[1]);
    paint();

    return {
      get: () => [lo, hi >= max ? null : hi],
      reset() {
        lo = min;
        hi = max;
        paint();
      },
    };
  };
})();
