// Slide motion is Reveal's own: a deck-wide transition, speed and background transition, plus per-slide
// data-transition, data-transition-speed and data-background-transition attributes. A chapter is only a named set of
// those same values. A slide starts a chapter with data-chapter, and the chapter then supplies any value a slide has not
// set itself, up to the next data-chapter. Precedence is deck default < chapter default < the slide's own attribute,
// and no other animation layer is involved.

export const transitionStyles = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom'] as const;
export const transitionSpeeds = ['default', 'fast', 'slow'] as const;

export type TransitionStyle = (typeof transitionStyles)[number];
export type TransitionSpeed = (typeof transitionSpeeds)[number];

export interface TransitionDefaults {
  style?: TransitionStyle;
  speed?: TransitionSpeed;
  background?: TransitionStyle;
}

// A chapter or slide style may also split entering from leaving, such as "slide-in fade-out".
export interface ChapterTransition {
  style?: string;
  speed?: TransitionSpeed;
  background?: TransitionStyle;
}

// Reveal has no -in or -out rule for none; it would fall back to a fade, so none is never part of a pair.
const pairStyles: readonly string[] = transitionStyles.filter((style) => style !== 'none');
const attributes = { style: 'data-transition', speed: 'data-transition-speed', background: 'data-background-transition' } as const;

function list(values: readonly string[]) {
  return `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}`;
}

export function checkStyle(value: string, where: string, pair: boolean): string {
  const tokens = value.trim().split(/\s+/);
  if (tokens.length === 1 && (transitionStyles as readonly string[]).includes(tokens[0])) return tokens[0];
  if (pair && tokens.length === 2) {
    const entering = tokens.filter((token) => token.endsWith('-in'));
    const leaving = tokens.filter((token) => token.endsWith('-out'));
    if (entering.length === 1 && leaving.length === 1 &&
        [...entering, ...leaving].every((token) => pairStyles.includes(token.replace(/-(in|out)$/, '')))) {
      return tokens.join(' ');
    }
    throw new Error(`${where} "${value}" is not a valid in/out pair. Use one -in and one -out style, such as "slide-in fade-out". Styles: ${list(pairStyles)}.`);
  }
  throw new Error(`${where} "${value}" is not supported. Use ${list(transitionStyles)}${pair ? ', or an in/out pair such as "slide-in fade-out"' : ''}.`);
}

export function checkSpeed(value: string, where: string): TransitionSpeed {
  const speed = value.trim();
  if ((transitionSpeeds as readonly string[]).includes(speed)) return speed as TransitionSpeed;
  throw new Error(`${where} "${value}" is not supported. Use ${list(transitionSpeeds)}.`);
}

function checkAttributes(slide: HTMLElement) {
  const where = (attribute: string) => `slides.md: slide "${slide.id}" ${attribute}`;
  const style = slide.getAttribute(attributes.style);
  const speed = slide.getAttribute(attributes.speed);
  const background = slide.getAttribute(attributes.background);
  if (style !== null) checkStyle(style, where(attributes.style), true);
  if (speed !== null) checkSpeed(speed, where(attributes.speed));
  if (background !== null) checkStyle(background, where(attributes.background), false);
}

// A slide's own attribute always wins, so a chapter only fills the gaps. Chapters apply to the slides themselves, not to
// the grouping section around a vertical stack, and never touch the slide text. Chapter definitions that no slide uses
// are harmless, so replacing the starter slides never breaks the deck.
export function applyTransitions(slides: HTMLElement[], chapters: Record<string, ChapterTransition>) {
  let current: ChapterTransition | undefined;
  for (const slide of slides) {
    checkAttributes(slide);
    const name = slide.getAttribute('data-chapter');
    if (name !== null) {
      if (!Object.hasOwn(chapters, name)) {
        const defined = Object.keys(chapters);
        throw new Error(`slides.md: slide "${slide.id}" data-chapter "${name}" is not defined in deck.config.json. ${defined.length ? `Defined chapters: ${defined.join(', ')}.` : 'Add it under "chapters".'}`);
      }
      current = chapters[name];
    }
    if (!current) continue;
    for (const [key, attribute] of Object.entries(attributes)) {
      const value = current[key as keyof ChapterTransition];
      if (value !== undefined && !slide.hasAttribute(attribute)) slide.setAttribute(attribute, value);
    }
  }
}
