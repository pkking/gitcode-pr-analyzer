import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-[32px] border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">GitCode PR Analyzer</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">声明式路由驱动的浏览与分析入口</h1>
          <p className="mt-4 max-w-3xl text-sm text-stone-300 sm:text-base">
            首页只负责定向。Browse 承载组织与仓库 drill-down，Analysis 承载单次 run 的独立分析与最近运行切换。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/browse" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100">
              Enter Browse
            </Link>
            <Link to="/analysis" className="rounded-full border border-stone-700 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-stone-900">
              Enter Analysis
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <Card
            eyebrow="Route Area"
            title="Home"
            body="轻量入口页，不再承载实际数据浏览状态。"
          />
          <Card
            eyebrow="Route Area"
            title="Browse"
            body="使用组织与仓库层级恢复上下文，并把 run 选择导向独立分析页。"
          />
          <Card
            eyebrow="Route Area"
            title="Analysis"
            body="支持直接进入 run 分析，也支持在页内切换同仓库最近运行。"
          />
        </section>
      </div>
    </div>
  );
}

function Card({ eyebrow, title, body }) {
  return (
    <div className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
      <div className="text-xs uppercase tracking-[0.3em] text-stone-500">{eyebrow}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">{title}</div>
      <div className="mt-3 text-sm text-stone-600">{body}</div>
    </div>
  );
}
