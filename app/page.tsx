'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Sun,
  Leaf,
  House,
  Flag,
  ArrowUpRight,
} from 'lucide-react';
import { Moon, Cloud, CloudRain, Snowflake, Maximize } from 'lucide-react';
import { watchEnvironment, type Environment } from '@/lib/environment';
import { Button } from '@/components/ui/button';
import type { StableWorld } from '@/lib/world';
export default function Home() {
  const mount = useRef<HTMLDivElement>(null);
  const world = useRef<StableWorld | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const latestEnvironment = useRef<Environment | null>(null);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [status, setStatus] = useState('箱庭を準備しています…');
  const [counts, setCounts] = useState({ rest: 0, graze: 0, run: 0, walk: 0 });
  useEffect(() => {
    let disposed = false;
    const stopWeather = watchEnvironment((value) => {
      latestEnvironment.current = value;
      setEnvironment(value);
      world.current?.setEnvironment(value);
    });
    import('@/lib/world')
      .then(({ createWorld }) => {
        if (disposed || !mount.current) return;
        world.current = createWorld(mount.current, setCounts, setStatus);
        if (latestEnvironment.current)
          world.current.setEnvironment(latestEnvironment.current);
        setStatus('');
      })
      .catch(() =>
        setStatus(
          '3Dを表示できませんでした。WebGL 2対応のSafariなどで再読み込みしてください。',
        ),
      );
    return () => {
      disposed = true;
      stopWeather();
      world.current?.dispose();
      world.current = null;
    };
  }, []);
  const WeatherIcon =
    environment?.weather?.kind === 'snow'
      ? Snowflake
      : environment?.weather?.kind === 'rain' ||
          environment?.weather?.kind === 'storm'
        ? CloudRain
        : environment?.weather?.kind === 'cloud' ||
            environment?.weather?.kind === 'fog'
          ? Cloud
          : environment && environment.daylight < 0.3
            ? Moon
            : Sun;
  return (
    <main
      className="stable-app"
      data-night={environment ? environment.daylight < 0.3 : false}
    >
      <section
        className="world-panel"
        aria-label="固定クォータービューの馬の箱庭"
      >
        <div
          className="scene"
          ref={mount}
          role="img"
          aria-label="10頭のローポリゴンの馬が厩舎で休み、牧草地で草を食べ、楕円の競馬場を走る3D箱庭"
        />
        <div className="weather">
          <WeatherIcon size={20} />
          <div>
            <span>伊勢崎市 · {environment?.clock ?? '--:--'} JST</span>
            <small>
              {environment?.weather
                ? environment.weather.label +
                  ' ' +
                  Math.round(environment.weather.temperature) +
                  '°C' +
                  (environment.stale ? '（更新待ち）' : '')
                : environment?.stale
                  ? '天気を取得できません'
                  : '天気を取得中…'}
            </small>
          </div>
        </div>

        <div className="scene-caption">
          <span className="live-dot" />
          <span>
            {paused ? '馬たちの動きをとめています' : '馬たちの、いつもの一日'}
          </span>
        </div>
        <div className="view-label">
          <ArrowUpRight size={16} />{' '}
          <span className="pinch-hint">2本指で拡大・縮小・移動</span>
        </div>
        <div className="zoom-controls" aria-label="再生と表示の操作">
          <Button
            disabled={!!status}
            className="control pause"
            aria-label={paused ? '再生' : '一時停止'}
            aria-pressed={paused}
            onClick={() => {
              const value = !paused;
              setPaused(value);
              world.current?.setPaused(value);
            }}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={!!status}
            aria-label="全体表示に戻す"
            onClick={() => world.current?.resetZoom()}
          >
            <Maximize />
          </Button>
        </div>
        {status && (
          <div className="scene-status" role="status">
            {status}
          </div>
        )}
        <div className="scene-footer">
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Weather by Open-Meteo
          </a>
          <span>10 HORSES · ONE LITTLE HOME</span>
        </div>
        <footer className="toolbar">
          <div className="population">
            <strong>
              10<span>頭</span>
            </strong>
            <span>暮らしている馬</span>
          </div>
          <div className="activities" aria-label="馬の現在の行動">
            <div>
              <House />
              <span>休憩</span>
              <b>{counts.rest}</b>
            </div>
            <div>
              <Leaf />
              <span>採食</span>
              <b>{counts.graze}</b>
            </div>
            <div>
              <Flag />
              <span>走行</span>
              <b>{counts.run}</b>
            </div>
            <div className="walking">
              <span>移動中</span>
              <b>{counts.walk}</b>
            </div>
          </div>
          <div className="controls">
            <Button
              disabled={!!status}
              variant="outline"
              className="control"
              aria-pressed={fast}
              onClick={() => {
                const value = !fast;
                setFast(value);
                world.current?.setSpeed(value ? 2 : 1);
              }}
            >
              {fast ? '2×' : '1×'}
              <span>速度</span>
            </Button>
          </div>
        </footer>
      </section>
    </main>
  );
}
