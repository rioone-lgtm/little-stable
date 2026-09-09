'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StableHero, HERO_OPTIONS } from '../../components/stable/StableHero';
import { environmentAt } from '../../lib/stable/environment';
import styles from './preview.module.css';

export default function HeroPreview() {
  const [hour, setHour] = useState(22);
  const [minimum, setMinimum] = useState(0.25);
  const options = useMemo(
    () => ({
      ...HERO_OPTIONS,
      minDaylight: minimum,
      initialEnvironment: environmentAt(
        Date.parse('2026-09-09T00:00:00+09:00') + hour * 3600000,
      ),
    }),
    [hour, minimum],
  );
  return (
    <main className={styles.page}>
      <header className={styles.controls}>
        <h1>ヒーロー表示の確認</h1>
        <label>
          時刻（JST）{' '}
          <input
            aria-label="時刻"
            type="range"
            min="0"
            max="23"
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
          />{' '}
          {hour}:00
        </label>
        <label>
          夜間の明度{' '}
          <input
            aria-label="夜間の明度"
            type="range"
            min="0"
            max="0.5"
            step="0.05"
            value={minimum}
            onChange={(e) => setMinimum(Number(e.target.value))}
          />{' '}
          {minimum.toFixed(2)}
        </label>
        <Link href="/">デモに戻る</Link>
      </header>
      <div className={styles.wide} data-frame="wide">
        <StableHero posterSrc="/stable-poster.png" options={options} />
      </div>
      <p>16:9・非対話。背景グラデーションは親要素です。</p>
      <div className={styles.banner} data-frame="banner">
        <StableHero posterSrc="/stable-poster.png" options={options} />
      </div>
      <p>LP相当の2.1:1。</p>
      <div className={styles.phone} data-frame="phone">
        <StableHero posterSrc="/stable-poster.png" options={options} />
      </div>
      <p>スマホ縦枠。箱庭の上からもページをスクロールできます。</p>
      <div className={styles.spacer}>画面外停止を確認するための余白</div>
    </main>
  );
}
