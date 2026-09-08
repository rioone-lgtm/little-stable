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
import { Button } from '@/components/ui/button';
import type { StableWorld } from '@/lib/world';
export default function Home() {
  const mount = useRef<HTMLDivElement>(null);
  const world = useRef<StableWorld | null>(null);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [status, setStatus] = useState('箱庭を準備しています…');
  const [counts, setCounts] = useState({ rest: 0, graze: 0, run: 0, walk: 0 });
  useEffect(() => {
    let disposed = false;
    import('@/lib/world')
      .then(({ createWorld }) => {
        if (disposed || !mount.current) return;
        world.current = createWorld(mount.current, setCounts, setStatus);
        setStatus('');
      })
      .catch(() =>
        setStatus(
          '3Dを表示できませんでした。WebGL 2対応のSafariなどで再読み込みしてください。',
        ),
      );
    return () => {
      disposed = true;
      world.current?.dispose();
      world.current = null;
    };
  }, []);
  return (
    <main className="stable-app">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark">
            <House size={23} strokeWidth={1.6} />
          </span>
          <div>
            <p className="eyebrow">A LITTLE WORLD OF HORSES</p>
            <h1>
              Little Stable<span>小さな厩舎</span>
            </h1>
          </div>
        </div>
        <div className="weather">
          <Sun size={20} />
          <span>ある晴れた午後</span>
          <i />
        </div>
      </header>
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
        <div className="scene-caption">
          <span className="live-dot" />
          <span>
            {paused ? '時間をとめています' : '馬たちの、いつもの一日'}
          </span>
        </div>
        <div className="view-label">
          <ArrowUpRight size={16} /> FIXED VIEW <span>01</span>
        </div>
        {status && (
          <div className="scene-status" role="status">
            {status}
          </div>
        )}
        <div className="scene-footer">
          <span>のんびり、眺めていこう。</span>
          <span>10 HORSES · ONE LITTLE HOME</span>
        </div>
      </section>
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
            <span>{paused ? '再生' : '一時停止'}</span>
          </Button>
        </div>
      </footer>
    </main>
  );
}
