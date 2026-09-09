/* oxlint-disable jsx-a11y/prefer-tag-over-role, next/no-img-element -- A composite canvas/image and native eager poster keep this portable beyond Next.js. */
'use client';
import { useEffect, useRef } from 'react';
import {
  watchEnvironment,
  type EnvironmentOptions,
} from '../../lib/stable/environment';
import type { StableWorld, WorldOptions } from '../../lib/stable/world';
import styles from './StableHero.module.css';

export type StableHeroProps = {
  /** Eager poster URL supplied by the embedding site (public asset or CDN). */
  posterSrc: string;
  ariaLabel?: string;
  className?: string;
  options?: WorldOptions;
  environment?: EnvironmentOptions;
  onStatus?: (status: string) => void;
};
export const HERO_OPTIONS: WorldOptions = {
  fit: 'cover',
  offset: { x: 0, y: 0.06 },
  background: 'transparent',
  interactive: false,
  autoPause: true,
  minDaylight: 0.25,
  reducedMotion: 'static',
};
const NO_POLL: EnvironmentOptions = { polling: false };

/** No UI or headings. Weather polling is opt-in; the parent owns attribution. */
export function StableHero({
  posterSrc,
  ariaLabel = '厩舎と牧草地、トラックで暮らす馬たちの3D箱庭',
  className,
  options = HERO_OPTIONS,
  environment = NO_POLL,
  onStatus,
}: StableHeroProps) {
  const mount = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let world: StableWorld | undefined;
    let stopWeather: (() => void) | undefined;
    const host = mount.current;
    const setReady = (value: boolean) => {
      if (root.current) root.current.dataset.ready = String(value);
    };
    setReady(false);
    const status = (text: string) => {
      if (disposed) return;
      if (text) setReady(false);
      onStatus?.(text);
    };
    import('../../lib/stable/world')
      .then(({ createWorld }) => {
        if (disposed || !host) return;
        // Subscribe before construction so injected weather reaches the very first frame.
        let latest = options.initialEnvironment;
        if (!options.initialEnvironment)
          stopWeather = watchEnvironment(
            (value) => {
              latest = value;
              world?.setEnvironment(value);
            },
            {
              ...environment,
              location: environment.location ?? options.config?.farm.location,
            },
          );
        world = createWorld(host, () => {}, status, {
          ...HERO_OPTIONS,
          ...options,
          initialEnvironment: latest,
          onReady: () => {
            if (!disposed) {
              setReady(true);
              status('');
              options.onReady?.();
            }
          },
        });
      })
      .catch(() => {
        stopWeather?.();
        world?.dispose();
        status('3D unavailable');
      });
    return () => {
      disposed = true;
      stopWeather?.();
      world?.dispose();
    };
  }, [options, environment, onStatus]);
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={ariaLabel}
      ref={root}
    >
      <img
        className={styles.poster}
        src={posterSrc}
        alt=""
        aria-hidden="true"
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
      <div className={styles.canvas} ref={mount} aria-hidden="true" />
    </div>
  );
}
