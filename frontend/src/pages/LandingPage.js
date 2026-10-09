import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

/**
 * LandingPage — public home page for quick-wing.com.
 *
 * Markup, copy and CSS are a 1:1 port of the supplied design file. The CSS is
 * scoped under #qw-landing so it cannot leak into the logged-in app, and the
 * contact form posts to the existing /api/public/contact backend (emails Lee).
 */
const LANDING_CSS = `#qw-landing{
  --navy:#0A1A3A; --navy-2:#13254D; --ink:#0A1A3A; --body:#3B4866; --muted:#4A5878;
  --line:#E3E8F2; --line-2:#DCE3F0; --bg:#F6F8FC; --white:#FFFFFF;
  --blue:#1D4ED8; --blue-dark:#163BA6; --blue-light:#8FB0FF; --on-navy:#C8D3EA; --on-navy-muted:#A9B7D6;
  --gold:#C9A24B; --gold-text:#8A6A1F; --gold-light:#F3E3B8;
  --radius:20px; --max:1240px;
}
#qw-landing *{box-sizing:border-box}
html.qw-home{scroll-behavior:smooth;scroll-padding-top:88px}
#qw-landing{margin:0;background:var(--bg);color:var(--ink);font-family:Manrope,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
#qw-landing img,#qw-landing video{display:block;max-width:100%}
#qw-landing a{color:var(--blue);text-decoration:none}
#qw-landing a:hover{color:var(--blue-dark)}
#qw-landing .wrap{max-width:var(--max);margin:0 auto;padding-left:40px;padding-right:40px}
#qw-landing .eyebrow{margin:0;font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--blue)}
#qw-landing .on-navy .eyebrow{color:var(--blue-light)}
#qw-landing h1,#qw-landing h2,#qw-landing h3{margin:0}
#qw-landing .h2{margin-top:16px;font-size:46px;line-height:1.08;font-weight:800;letter-spacing:-.025em}
#qw-landing .lead{margin:20px 0 0;font-size:18px;line-height:1.6;color:var(--body)}
#qw-landing .on-navy{background:var(--navy);color:#fff}
#qw-landing .on-navy .lead{color:var(--on-navy)}
#qw-landing .section{padding-top:120px;padding-bottom:120px}
#qw-landing .row{display:flex;flex-wrap:wrap;gap:56px}
#qw-landing .col{flex:1 1 440px;min-width:0}
#qw-landing .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 24px;border-radius:10px;font:700 15px Manrope,system-ui,sans-serif;letter-spacing:.01em;cursor:pointer;border:1px solid transparent;transition:background .2s,border-color .2s,color .2s}
#qw-landing .btn-primary{background:var(--blue);color:#fff}
#qw-landing .btn-primary:hover{background:var(--blue-dark);color:#fff}
#qw-landing .btn-ghost-dark{border-color:rgba(255,255,255,.28);color:#fff}
#qw-landing .btn-ghost-dark:hover{border-color:#fff;color:#fff}
#qw-landing .btn-ghost{border-color:#C9D3E6;color:var(--navy);background:#fff}
#qw-landing .btn-ghost:hover{border-color:var(--navy);color:var(--navy)}
#qw-landing :focus-visible{outline:3px solid var(--blue-light);outline-offset:2px}
/* nav */#qw-landing .nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
#qw-landing .nav-in{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-top:12px;padding-bottom:12px}
#qw-landing .nav-logo img{height:54px;width:auto}
#qw-landing .nav-links{display:flex;align-items:center;gap:28px}
#qw-landing .nav-links a,#qw-landing .nav-login{color:#24314F;font-weight:600;font-size:15px;padding:10px 4px}
#qw-landing .nav-links a:hover,#qw-landing .nav-login:hover{color:var(--blue)}
#qw-landing .nav-right{display:flex;align-items:center;gap:12px}
#qw-landing .menu-btn{display:none;width:48px;height:48px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--navy);cursor:pointer;align-items:center;justify-content:center}
#qw-landing .mobile-menu{display:none;border-top:1px solid var(--line);padding:8px 20px 20px;background:#fff}
#qw-landing .mobile-menu a{display:block;padding:14px 0;border-bottom:1px solid var(--line);color:var(--navy);font-weight:600}
#qw-landing .mobile-menu.open{display:block}
/* hero */#qw-landing .hero-in{display:flex;flex-wrap:wrap;gap:56px;align-items:center;padding-top:88px}
#qw-landing .hero-copy{flex:1 1 480px;min-width:0;padding-bottom:64px}
#qw-landing .award-pill{display:inline-flex;align-items:center;gap:12px;padding:8px 16px 8px 8px;border:1px solid rgba(201,162,75,.5);border-radius:999px;color:var(--gold-light);font-size:14px;font-weight:600}
#qw-landing .award-pill:hover{color:#fff;border-color:var(--gold)}
#qw-landing .award-pill i{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:var(--gold);color:var(--navy)}
#qw-landing .hero h1{margin-top:16px;font-size:62px;line-height:1.04;font-weight:800;letter-spacing:-.03em}
#qw-landing .hero h1 span{color:var(--blue-light)}
#qw-landing .hero-sub{margin:24px 0 0;max-width:540px;font-size:19px;line-height:1.6;color:var(--on-navy)}
#qw-landing .btns{display:flex;flex-wrap:wrap;gap:14px;margin-top:36px}
#qw-landing .stats{display:flex;flex-wrap:wrap;gap:28px;margin-top:48px;padding-top:28px;border-top:1px solid rgba(255,255,255,.12)}
#qw-landing .stat b{display:block;font-size:34px;font-weight:800;letter-spacing:-.02em}
#qw-landing .stat span{display:block;font-size:13px;color:var(--on-navy-muted);margin-top:4px;max-width:170px}
#qw-landing .hero-visual{flex:1 1 520px;min-width:0;position:relative;align-self:flex-end}
#qw-landing .browser{background:#fff;border-radius:18px 18px 0 0;padding:14px 14px 0;box-shadow:0 -20px 80px rgba(29,78,216,.35)}
#qw-landing .dots{display:flex;gap:6px;padding:2px 4px 12px}
#qw-landing .dots i{width:10px;height:10px;border-radius:999px;background:var(--line)}
#qw-landing .browser img{width:100%;border-radius:10px 10px 0 0}
#qw-landing .hero-phone{position:absolute;left:-48px;bottom:32px;width:190px;background:#0F172A;border-radius:26px;padding:8px;box-shadow:0 30px 60px rgba(0,0,0,.45)}
#qw-landing .hero-phone img{border-radius:20px}
/* trust */#qw-landing .trust{background:#fff;border-bottom:1px solid var(--line)}
#qw-landing .trust-in{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:32px;padding-top:36px;padding-bottom:36px}
#qw-landing .trust-item{display:flex;align-items:center;gap:16px;color:var(--navy)}
#qw-landing .tag{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
/* award */#qw-landing .award-grid{flex:1 1 520px;min-width:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
#qw-landing .award-grid .big{grid-column:span 3;width:100%;height:520px;object-fit:cover;object-position:50% 30%;border-radius:16px}
#qw-landing .award-grid .stack{grid-column:span 2;display:flex;flex-direction:column;gap:16px}
#qw-landing .award-grid .stack img{width:100%;height:252px;object-fit:cover;object-position:50% 45%;border-radius:16px}
#qw-landing .facts{margin-top:36px;border-top:1px solid var(--line-2)}
#qw-landing .facts div{display:flex;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--line-2)}
#qw-landing .facts span:first-child{color:var(--muted)}
#qw-landing .facts span:last-child{font-weight:700;text-align:right}
/* features */#qw-landing .head-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:24px}
#qw-landing .split-photo{margin-top:56px;display:flex;flex-wrap:wrap;gap:20px}
#qw-landing .split-photo figure{position:relative;flex:1 1 380px;min-width:0;margin:0;border-radius:var(--radius);overflow:hidden;height:340px}
#qw-landing .split-photo img{width:100%;height:100%;object-fit:cover}
#qw-landing .split-photo figcaption{position:absolute;left:20px;bottom:20px;background:rgba(10,26,58,.88);color:#fff;padding:10px 16px;border-radius:10px;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase}
#qw-landing .tabs-wrap{margin-top:64px;display:flex;flex-wrap:wrap;gap:40px;align-items:flex-start}
#qw-landing .tabs{flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:6px}
#qw-landing .tab{all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;padding:18px 20px;border-radius:12px;border:1px solid transparent;transition:background .2s,border-color .2s,box-shadow .2s}
#qw-landing .tab:hover{background:#fff;border-color:var(--line)}
#qw-landing .tab[aria-selected="true"]{background:#fff;border-color:#C9D3E6;box-shadow:0 10px 30px rgba(10,26,58,.08)}
#qw-landing .tab:focus-visible{outline:3px solid var(--blue-light);outline-offset:2px}
#qw-landing .tab-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
#qw-landing .tab-top b{font-weight:800;font-size:18px;color:var(--navy)}
#qw-landing .tab-top span{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--muted)}
#qw-landing .tab p{margin:6px 0 0;font-size:15px;line-height:1.5;color:var(--body)}
#qw-landing .tab-stage{flex:999 1 560px;min-width:0;background:#EEF2FA;border-radius:var(--radius);padding:32px;display:flex;justify-content:center}
#qw-landing .tab-stage div{width:100%;max-width:620px;background:#fff;border-radius:14px;box-shadow:0 24px 60px rgba(10,26,58,.14);padding:10px}
#qw-landing .tab-stage img{width:100%;border-radius:10px}
#qw-landing .phones{margin-top:56px;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:28px}
#qw-landing .phone{background:var(--navy-2);border-radius:22px;padding:10px}
#qw-landing .phone img{border-radius:14px;width:100%}
#qw-landing .phones h3{margin-top:22px;font-size:19px;font-weight:800}
#qw-landing .phones p{margin:8px 0 0;font-size:15px;line-height:1.55;color:var(--on-navy)}
/* video */#qw-landing .video-in{display:flex;flex-wrap:wrap;gap:64px;align-items:center}
#qw-landing .video-frame{flex:0 1 360px;margin:0 auto;background:#0F172A;border-radius:34px;padding:10px;box-shadow:0 40px 90px rgba(10,26,58,.35)}
#qw-landing .video-frame video{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:26px;background:#0F172A}
#qw-landing .video-copy{flex:1 1 440px;min-width:0}
#qw-landing .video-photo{margin-top:36px;border-radius:var(--radius);overflow:hidden;height:300px}
#qw-landing .video-photo img{width:100%;height:100%;object-fit:cover;object-position:50% 30%}
/* proof */#qw-landing .proof{display:flex;flex-wrap:wrap;gap:32px}
#qw-landing .card{flex:1 1 460px;min-width:0;border-radius:var(--radius);padding:48px;display:flex;flex-direction:column}
#qw-landing .card-light{background:#fff;border:1px solid var(--line);justify-content:space-between;gap:32px;margin:0}
#qw-landing .card-light blockquote{margin:24px 0 0;font-size:24px;line-height:1.5;font-weight:600;letter-spacing:-.01em}
#qw-landing .card-light figcaption{display:flex;align-items:center;gap:18px;padding-top:24px;border-top:1px solid var(--line)}
#qw-landing .card-dark{background:var(--navy);color:#fff;gap:28px}
#qw-landing .card-dark p{margin:0;font-size:17px;line-height:1.65;color:var(--on-navy)}
#qw-landing .who{display:flex;align-items:center;gap:16px}
#qw-landing .who b,#qw-landing .who small{display:block}
#qw-landing .who small{color:var(--muted);font-size:15px}
#qw-landing .card-dark .who small{color:var(--on-navy-muted)}
#qw-landing .avatar{width:64px;height:64px;border-radius:999px;object-fit:cover;object-position:72% 28%}
#qw-landing .pod{display:flex;align-items:center;gap:16px;padding:14px;border:1px solid rgba(255,255,255,.16);border-radius:14px;color:#fff}
#qw-landing .pod:hover{color:#fff;border-color:rgba(255,255,255,.4)}
#qw-landing .pod img{width:56px;height:56px;border-radius:10px;object-fit:cover}
#qw-landing .pod span{flex:1;font-weight:600;font-size:15px;line-height:1.45}
/* roi */#qw-landing .roi{margin-top:56px;display:flex;flex-wrap:wrap;gap:32px}
#qw-landing .roi-in{flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:32px;padding:40px;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg)}
#qw-landing .roi-row{display:flex;justify-content:space-between;align-items:baseline}
#qw-landing .roi-row label,#qw-landing legend{font-weight:700}
#qw-landing .roi-row output{font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:500}
#qw-landing input[type=range]{width:100%;accent-color:var(--blue);height:28px}
#qw-landing fieldset{border:0;margin:0;padding:0}
#qw-landing legend{margin-bottom:12px}
#qw-landing .plan-btns{display:flex;gap:10px;flex-wrap:wrap}
#qw-landing .plan-btns .btn{background:#fff;color:var(--navy);border-color:#C9D3E6}
#qw-landing .plan-btns .btn[aria-pressed="true"]{background:var(--blue);color:#fff;border-color:var(--blue)}
#qw-landing .roi-out{flex:1 1 420px;min-width:0;padding:40px;border-radius:var(--radius);background:var(--navy);color:#fff;display:flex;flex-direction:column;gap:28px}
#qw-landing .roi-out small{display:block;font-size:14px;color:var(--on-navy-muted)}
#qw-landing .roi-big{font-size:64px;font-weight:800;letter-spacing:-.03em;line-height:1.1}
#qw-landing .roi-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;padding-top:24px;border-top:1px solid rgba(255,255,255,.14)}
#qw-landing .roi-two b{display:block;font-size:28px;font-weight:800;margin-top:4px}
#qw-landing .roi-net{padding:20px 24px;border-radius:14px;background:var(--navy-2)}
#qw-landing .roi-net b{display:block;font-size:36px;font-weight:800;color:var(--blue-light);margin-top:2px}
#qw-landing .roi-note{margin:0;font-size:13px;line-height:1.55;color:var(--on-navy-muted)}
/* pricing */#qw-landing .prices{margin:56px auto 0;max-width:960px;display:flex;flex-wrap:wrap;gap:28px}
#qw-landing .price{flex:1 1 380px;min-width:0;border-radius:var(--radius);padding:44px;display:flex;flex-direction:column}
#qw-landing .price-light{background:#fff;border:1px solid var(--line-2)}
#qw-landing .price-dark{background:var(--navy);color:#fff;box-shadow:0 30px 70px rgba(10,26,58,.25)}
#qw-landing .price h3{font-size:20px;font-weight:800}
#qw-landing .price-top{display:flex;justify-content:space-between;align-items:center;gap:12px}
#qw-landing .badge{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:6px 10px;border-radius:999px;background:var(--blue);color:#fff}
#qw-landing .amount{margin-top:20px;display:flex;align-items:baseline;gap:8px}
#qw-landing .amount b{font-size:56px;font-weight:800;letter-spacing:-.03em}
#qw-landing .amount span{color:var(--muted)}
#qw-landing .price-dark .amount span{color:var(--on-navy-muted)}
#qw-landing .price ul{margin:28px 0 0;padding:28px 0 0;border-top:1px solid var(--line);list-style:none;display:flex;flex-direction:column;gap:14px;font-size:16px;line-height:1.45}
#qw-landing .price-dark ul{border-top-color:rgba(255,255,255,.14)}
#qw-landing .price li{display:flex;gap:12px}
#qw-landing .price li svg{flex:none;margin-top:1px}
#qw-landing .price .map{margin-top:28px;border-radius:12px;overflow:hidden}
#qw-landing .price .map img{width:100%;height:170px;object-fit:cover;object-position:50% 60%}
#qw-landing .price .btn{margin-top:auto}
#qw-landing .price ul+.btn,#qw-landing .price .map+.btn{margin-top:36px}
/* contact */#qw-landing .contact-info{margin-top:40px;display:flex;flex-direction:column;gap:18px}
#qw-landing .contact-info a{display:flex;align-items:center;gap:14px;color:#fff;font-weight:700;font-size:18px}
#qw-landing .contact-info div{display:flex;align-items:center;gap:14px;color:var(--on-navy);font-size:17px}
#qw-landing .ready{margin-top:48px;padding-top:28px;border-top:1px solid rgba(255,255,255,.14)}
#qw-landing .ready b{font-size:22px;font-weight:800}
#qw-landing .ready p{margin:6px 0 0;color:var(--on-navy)}
#qw-landing .form{flex:1 1 460px;min-width:0;background:#fff;color:var(--navy);border-radius:var(--radius);padding:40px;display:flex;flex-direction:column;gap:20px}
#qw-landing .field{display:flex;flex-direction:column;gap:8px}
#qw-landing .field label{font-weight:700;font-size:14px}
#qw-landing .field input,#qw-landing .field textarea{width:100%;min-height:50px;padding:12px 14px;border:1px solid #C9D3E6;border-radius:10px;font:500 15px Manrope,system-ui,sans-serif;color:var(--navy);background:#fff}
#qw-landing .field textarea{resize:vertical}
#qw-landing .form-note{margin:0;font-size:13px;color:var(--muted);text-align:center}
/* footer */#qw-landing .footer{background:#fff;border-top:1px solid var(--line)}
#qw-landing .footer-in{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px;padding-top:40px;padding-bottom:40px}
#qw-landing .footer nav{display:flex;flex-wrap:wrap;gap:24px;font-size:15px;font-weight:600}
#qw-landing .footer nav a{color:#24314F}
#qw-landing .footer nav a:hover{color:var(--blue)}
#qw-landing .footer small{font-size:14px;color:var(--muted)}
@media (max-width:960px){
#qw-landing .nav-links{display:none}
#qw-landing .menu-btn{display:inline-flex}
#qw-landing .hero-phone{display:none}
}
@media (max-width:720px){
#qw-landing .wrap{padding-left:20px;padding-right:20px}
#qw-landing .section{padding-top:80px;padding-bottom:80px}
#qw-landing .hero-in{padding-top:56px}
#qw-landing .hero h1{font-size:40px}
#qw-landing .h2{font-size:32px}
#qw-landing .nav-logo img{height:44px}
#qw-landing .nav-login{display:none}
#qw-landing .award-grid .big{height:380px}
#qw-landing .award-grid .stack img{height:182px}
#qw-landing .card,#qw-landing .roi-in,#qw-landing .roi-out,#qw-landing .price,#qw-landing .form{padding:28px}
#qw-landing .roi-big{font-size:48px}
#qw-landing .split-photo figure{height:240px}
/* feature tabs become a swipeable row, screenshot right under it */#qw-landing .tabs-wrap{gap:20px;margin-top:40px}
#qw-landing .tabs{flex-direction:row;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;margin:0;padding:4px 0 8px;scrollbar-width:none}
#qw-landing .tabs::-webkit-scrollbar{display:none}
#qw-landing .tab{flex:0 0 78%;scroll-snap-align:start;background:#fff;border-color:var(--line)}
#qw-landing .tab-stage{padding:14px}
/* field phones become a swipeable carousel */#qw-landing .phones{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:16px;margin:40px 0 0;padding:0 0 8px;scrollbar-width:none}
#qw-landing .phones::-webkit-scrollbar{display:none}
#qw-landing .phones>div{flex:0 0 72%;scroll-snap-align:start}
#qw-landing .swipe-hint{display:block !important}
#qw-landing .card-light blockquote{font-size:19px}
#qw-landing .roi-row output{white-space:nowrap;margin-left:12px}
#qw-landing .footer-in{flex-direction:column;align-items:flex-start}
#qw-landing .footer small{text-align:left !important}
#qw-landing .video-photo{height:220px}
}
#qw-landing .swipe-hint{display:none;margin-top:14px;font-size:13px;color:var(--muted)}
#qw-landing .on-navy .swipe-hint{color:var(--on-navy-muted)}
/* 16px inputs stop iPhone zooming in when a field is tapped */#qw-landing .field input,#qw-landing .field textarea{font-size:16px}
#qw-landing h1,#qw-landing h2,#qw-landing h3,#qw-landing h4{color:inherit;letter-spacing:normal;font-family:Manrope,system-ui,sans-serif}
#qw-landing .hero h1{letter-spacing:-.03em}
#qw-landing .h2{letter-spacing:-.025em}
#qw-landing :focus-visible{outline:3px solid var(--blue-light) !important;outline-offset:2px !important}
#qw-landing input:focus,#qw-landing textarea:focus{box-shadow:none;border-color:var(--blue)}
#qw-landing blockquote{margin:0}
#qw-landing button{font-family:Manrope,system-ui,sans-serif}`;

const LANDING_HTML = `<header class="nav">
  <div class="wrap nav-in">
    <a data-testid="landing-nav-logo" class="nav-logo" href="https://quick-wing.com/" aria-label="Quick Wing home"><img src="/images/quick-wing-logo-wide.png" alt="Quick Wing — Car Fleet Management"></a>
    <nav class="nav-links" aria-label="Main">
      <a href="#features">Features</a>
      <a href="#award">Award</a>
      <a href="#roi">ROI Calculator</a>
      <a href="#pricing">Pricing</a>
      <a href="https://quick-wing.com/contact">Contact</a>
    </nav>
    <div class="nav-right">
      <a data-testid="landing-nav-login" class="nav-login" href="https://quick-wing.com/login">Login</a>
      <a class="btn btn-primary" href="#contact">Get Started</a>
      <button data-testid="landing-menu-btn" class="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
  </div>
  <nav data-testid="landing-mobile-menu" class="mobile-menu" id="mobile-menu" aria-label="Mobile">
    <a href="#features">Features</a><a href="#award">Award</a><a href="#roi">ROI Calculator</a><a href="#pricing">Pricing</a><a href="https://quick-wing.com/contact">Contact</a><a href="https://quick-wing.com/login">Login</a>
  </nav>
</header>

<main>

<!-- HERO -->
<section class="hero on-navy" style="overflow:hidden">
  <div class="wrap hero-in">
    <div class="hero-copy">
      <a class="award-pill" href="#award">
        <i><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.4 7 22l5-3 5 3-1.2-8.6"/></svg></i>
        Winner · Technological Innovation of the Year 2026 · HCCI
      </a>
      <p class="eyebrow" style="margin-top:32px">Trusted by Irish Care Providers</p>
      <h1>Stay compliant. Reduce downtime. <span>Control your fleet.</span></h1>
      <p class="hero-sub">The simple, all-in-one system for vehicle bookings, compliance tracking, and live visibility. Built for teams that can't afford downtime.</p>
      <div class="btns">
        <a class="btn btn-primary" href="#contact">Get Started <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        <a class="btn btn-ghost-dark" href="#features">See features</a>
      </div>
      <div class="stats">
        <div class="stat"><b>73%</b><span>of fleet admin processes automated (Sept 2026)</span></div>
        <div class="stat"><b>€6.50</b><span>per vehicle, per month</span></div>
        <div class="stat"><b>1 afternoon</b><span>to set up</span></div>
      </div>
    </div>
    <div class="hero-visual">
      <div class="browser">
        <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
        <img src="/images/app-dashboard.jpg" alt="Quick Wing Live Fleet Status dashboard">
      </div>
      <div class="hero-phone"><img src="/images/app-mobile-home.jpg" alt="Quick Wing mobile home screen"></div>
    </div>
  </div>
</section>

<!-- TRUST BAR -->
<section class="trust">
  <div class="wrap trust-in">
    <div class="trust-item"><span class="tag">Client</span><img src="/images/bluebird-care-logo.jpg" alt="Bluebird Care" style="height:64px;width:auto"></div>
    <div class="trust-item"><span class="tag">Award</span><span style="font-weight:700;font-size:15px;line-height:1.35">HCCI Home Care Awards 2026<br><span style="font-weight:500;color:var(--muted)">Technological Innovation of the Year — Winner</span></span></div>
    <a class="trust-item" href="https://youtu.be/_oR2ROeUOp4"><span class="tag">As featured on</span><img src="/images/ai-six-podcast.jpg" alt="AI Six Podcast" style="height:56px;width:56px;object-fit:cover;border-radius:10px"><span style="font-weight:700;font-size:15px">AI Six Podcast</span></a>
  </div>
</section>

<!-- AWARD -->
<section id="award" class="section">
  <div class="wrap row" style="align-items:center;gap:64px">
    <div class="award-grid">
      <img class="big" src="/images/hcci-award-lee-walker.jpg" alt="Lee Walker holding the HCCI Technological Innovation of the Year 2026 award">
      <div class="stack">
        <img src="/images/hcci-award-certificate.jpg" alt="HCCI Home Care Awards 2026 winner certificate — Technological Innovation of the Year">
        <img src="/images/hcci-award-trophy.jpg" alt="HCCI Technological Innovation of the Year 2026 glass trophy">
      </div>
    </div>
    <div class="col" style="flex-basis:420px">
      <p class="eyebrow" style="color:var(--gold-text)">Award-winning software</p>
      <h2 class="h2">Technological Innovation of the Year 2026.</h2>
      <p class="lead">Quick Wing was recognised at the Home &amp; Community Care Ireland (HCCI) Home Care Awards 2026, winning Technological Innovation of the Year. The award was presented to founder Lee Walker, Bluebird Care – Kerry and West Cork.</p>
      <div class="facts">
        <div><span>Awarding body</span><span>Home &amp; Community Care Ireland</span></div>
        <div><span>Category</span><span>Technological Innovation of the Year</span></div>
        <div><span>In use at</span><span>Bluebird Care</span></div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURES: OFFICE -->
<section id="features" class="section" style="background:#fff;padding-bottom:96px">
  <div class="wrap">
    <div class="head-row">
      <div style="max-width:680px"><p class="eyebrow">Features</p><h2 class="h2">Built for both sides of the working day.</h2></div>
      <p class="lead" style="margin:0;max-width:380px">Less chasing. More clarity. Easier coordination.</p>
    </div>
    <div class="split-photo">
      <figure><img src="/images/photo-office.jpg" alt="Office coordinator managing bookings on Quick Wing" style="object-position:50% 40%"><figcaption>In the office</figcaption></figure>
      <figure><img src="/images/photo-field.jpg" alt="Team member checking Quick Wing on a phone beside a fleet van" style="object-position:50% 25%"><figcaption>Out in the field</figcaption></figure>
    </div>
    <div class="tabs-wrap">
      <div class="tabs" role="tablist" aria-label="Admin features">
        <button data-testid="landing-tab-app-dashboard" class="tab" role="tab" aria-selected="true" data-img="/images/app-dashboard.jpg" data-alt="Live Fleet Status dashboard"><span class="tab-top"><b>One organised admin view</b><span>01</span></span><p>Bookings and live status—without the chasing.</p></button>
        <button data-testid="landing-tab-app-booking" class="tab" role="tab" aria-selected="false" data-img="/images/app-booking.jpg" data-alt="Car Bookings — Create New Booking form"><span class="tab-top"><b>Booking management</b><span>02</span></span><p>Create, assign and repeat bookings, with AI Booking Intelligence.</p></button>
        <button data-testid="landing-tab-app-vehicles" class="tab" role="tab" aria-selected="false" data-img="/images/app-vehicles.jpg" data-alt="Fleet Vehicles with compliance reminders"><span class="tab-top"><b>Compliance and reporting</b><span>03</span></span><p>Reminders, fleet records and clear reports.</p></button>
        <button data-testid="landing-tab-app-reports" class="tab" role="tab" aria-selected="false" data-img="/images/app-reports.jpg" data-alt="Reports — bookings list, most booked cars, daily availability"><span class="tab-top"><b>Reports</b><span>04</span></span><p>All bookings, most-booked cars and daily availability, with CSV export.</p></button>
        <button data-testid="landing-tab-app-gps" class="tab" role="tab" aria-selected="false" data-img="/images/app-gps.jpg" data-alt="Live Fleet Map with GPS tracking"><span class="tab-top"><b>Live GPS visibility</b><span>05</span></span><p>Follow active journeys in one calm view.</p></button>
      </div>
      <p class="swipe-hint" aria-hidden="true" style="margin:0;flex-basis:100%">Swipe the cards, tap one to see it →</p>
      <div class="tab-stage" role="tabpanel"><div><img data-testid="landing-tab-image" id="tab-img" src="/images/app-dashboard.jpg" alt="Live Fleet Status dashboard"></div></div>
    </div>
  </div>
</section>

<!-- FEATURES: FIELD -->
<section class="section on-navy" style="padding-top:104px;padding-bottom:104px">
  <div class="wrap">
    <div class="head-row">
      <div style="max-width:640px"><p class="eyebrow">Out in the field</p><h2 class="h2">One clear view. Live.</h2></div>
      <p class="lead" style="margin:0;max-width:380px">People and vehicles moving together.</p>
    </div>
    <div class="phones">
      <div><div class="phone"><img src="/images/app-mobile-home.jpg" alt="Mobile home screen with live fleet status"></div><h3>For teams in the field</h3><p>Live availability—clear at a glance.</p></div>
      <div><div class="phone"><img src="/images/app-mobile-bookings.jpg" alt="My Bookings calendar on mobile"></div><h3>Book in seconds</h3><p>Personal bookings and calendars stay together.</p></div>
      <div><div class="phone"><img src="/images/app-mobile-docs.jpg" alt="Documents screen with incident reporting"></div><h3>Report from the field</h3><p>Checks and incidents—captured while details are fresh.</p></div>
      <div><div class="phone"><img src="/images/app-mobile-lift.jpg" alt="Request a Lift form on mobile"></div><h3>Built-in lift requests</h3><p>A simple taxi system for Quick Wing users.</p></div>
    </div>
    <p class="swipe-hint" aria-hidden="true">Swipe to see more →</p>
  </div>
</section>

<!-- VIDEO -->
<section class="section" style="background:#fff">
  <div class="wrap video-in">
    <div class="video-frame">
      <video controls playsinline preload="metadata" poster="/images/demo-poster.jpg">
        <source src="/video/quick-wing-demo.mp4" type="video/mp4">
      </video>
    </div>
    <div class="video-copy">
      <p class="eyebrow">See it in action</p>
      <h2 class="h2">Smarter fleet management, made simple.</h2>
      <p class="lead">Less administration. Better oversight. Easier to manage.</p>
      <div class="btns"><a class="btn btn-primary" href="#contact">Get Started</a><a class="btn btn-ghost" href="#pricing">See pricing</a></div>
      <div class="video-photo"><img src="/images/photo-mobile.jpg" alt="Coordinator checking Quick Wing on her phone"></div>
    </div>
  </div>
</section>

<!-- PROOF -->
<section class="section">
  <div class="wrap proof">
    <figure class="card card-light">
      <div>
        <p class="eyebrow">Success Story</p>
        <blockquote>“Quick Wing has completely changed how we run our fleet. Compliance is under control, downtime is down, and my team finally have visibility of every vehicle without chasing spreadsheets. It's the kind of tool you didn't know you needed until you can't imagine working without it.”</blockquote>
      </div>
      <figcaption><img src="/images/bluebird-care-logo.jpg" alt="Bluebird Care" style="height:56px;width:auto"><span class="who"><span><b>Director</b><small>Bluebird Care · Kerry &amp; West Cork</small></span></span></figcaption>
    </figure>
    <div class="card card-dark on-navy">
      <p class="eyebrow">From the founder</p>
      <h2 style="font-size:34px;line-height:1.15;font-weight:800;letter-spacing:-.02em">“Built from real experience.”</h2>
      <p>“I'm proud to announce the launch of Quick Wing. I built this to help businesses manage vehicle bookings, track compliance, and gain clear visibility in one place.”</p>
      <p>“Designed for real working teams who don't have time for complicated software.”</p>
      <div class="who" style="margin-top:auto"><img class="avatar" src="/images/hcci-award-lee-walker.jpg" alt="Lee Walker"><span><b>Lee Walker</b><small>Founder &amp; CEO, Quick Wing</small></span></div>
      <a class="pod" href="https://youtu.be/_oR2ROeUOp4"><img src="/images/ai-six-podcast.jpg" alt="AI Six Podcast"><span>Watch our founder discuss fleet intelligence on AI Six Podcast</span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/></svg></a>
    </div>
  </div>
</section>

<!-- ROI -->
<section id="roi" class="section" style="background:#fff;border-top:1px solid var(--line)">
  <div class="wrap">
    <div style="max-width:720px">
      <p class="eyebrow">ROI Calculator</p>
      <h2 class="h2">See what Quick Wing gives back.</h2>
      <p class="lead">Quick Wing is automating up to 73% of fleet admin processes (September 2026). Enter your numbers.</p>
    </div>
    <div class="roi">
      <div class="roi-in">
        <div><div class="roi-row"><label for="roi-v">Vehicles in your fleet</label><output id="o-v">20</output></div><input id="roi-v" type="range" min="1" max="150" step="1" value="20"></div>
        <div><div class="roi-row"><label for="roi-h">Hours per week on vehicle admin</label><output id="o-h">10 h</output></div><input id="roi-h" type="range" min="1" max="60" step="1" value="10"></div>
        <div><div class="roi-row"><label for="roi-r">Hourly staff cost</label><output id="o-r">€16</output></div><input id="roi-r" type="range" min="12" max="45" step="1" value="16"></div>
        <fieldset><legend>Plan</legend>
          <div class="plan-btns">
            <button data-testid="roi-plan-6-5" type="button" class="btn" data-price="6.5" aria-pressed="true">€6.50 · Software</button>
            <button data-testid="roi-plan-8-5" type="button" class="btn" data-price="8.5" aria-pressed="false">€8.50 · Software + GPS</button>
          </div>
        </fieldset>
      </div>
      <div class="roi-out" aria-live="polite">
        <div><small>Admin hours saved every month</small><div class="roi-big"><span id="r-hours">32</span> h</div></div>
        <div class="roi-two">
          <div><small>Staff time value saved</small><b id="r-value">€506</b></div>
          <div><small>Quick Wing cost</small><b id="r-cost">€130</b></div>
        </div>
        <div class="roi-net"><small>Net monthly return</small><b id="r-net">€376</b></div>
        <p class="roi-note">Estimate per month: hours × 52 ÷ 12 × 73% × hourly cost, minus vehicles × plan price. Your results will vary.</p>
        <a class="btn btn-primary" href="#contact" style="align-self:flex-start">Get Started</a>
      </div>
    </div>
  </div>
</section>

<!-- PRICING -->
<section id="pricing" class="section" style="border-top:1px solid var(--line)">
  <div class="wrap">
    <div style="text-align:center;max-width:720px;margin:0 auto"><p class="eyebrow">Pricing</p><h2 class="h2">Simple, per-vehicle pricing.</h2></div>
    <div class="prices">
      <div class="price price-light">
        <h3>Fleet Software</h3>
        <div class="amount"><b>€6.50</b><span>per vehicle / month</span></div>
        <ul>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Vehicle bookings &amp; shared calendar</li>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Live fleet status dashboard</li>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Compliance reminders &amp; fleet records</li>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Inspections &amp; incident reporting</li>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Built-in lift requests</li>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Reports &amp; CSV export</li>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>AI Booking Intelligence</li>
        </ul>
        <a class="btn btn-ghost" href="#contact">Get Started</a>
      </div>
      <div class="price price-dark">
        <div class="price-top"><h3>Fleet Software + Live GPS</h3><span class="badge">Full visibility</span></div>
        <div class="amount"><b>€8.50</b><span>per vehicle / month</span></div>
        <ul>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FB0FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Everything in Fleet Software</li>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FB0FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Live GPS tracking</li>
          <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FB0FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>Live fleet map — follow active journeys in one calm view</li>
        </ul>
        <div class="map"><img src="/images/app-gps.jpg" alt="Quick Wing Live Fleet Map"></div>
        <a class="btn btn-primary" href="#contact">Get Started</a>
      </div>
    </div>
  </div>
</section>

<!-- CONTACT -->
<section id="contact" class="section on-navy">
  <div class="wrap row" style="gap:64px">
    <div class="col" style="flex-basis:400px">
      <p class="eyebrow">Contact us</p>
      <h2 class="h2">Let's talk about your fleet.</h2>
      <p class="lead" style="margin-top:24px">Whether you're looking for a demo, a quote, or just have a quick question — drop your details in the form and Lee will personally get back to you.</p>
      <div class="contact-info">
        <a href="mailto:Lee@quick-wing.com"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8FB0FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Lee@quick-wing.com</a>
        <div><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8FB0FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>Online — available everywhere</div>
      </div>
      <div class="ready"><b>Ready to control your fleet?</b><p>Set up in a single afternoon. Talk to us to get started.</p></div>
    </div>
    <!-- EMERGENT: wire this form to the existing contact-form backend so every submission is emailed to Lee@quick-wing.com -->
    <form data-testid="landing-contact-form" class="form" id="contact-form" novalidate="">
      <div class="field"><label for="c-name">Full name*</label><input data-testid="contact-full-name" id="c-name" name="full_name" type="text" autocomplete="name" required></div>
      <div class="field"><label for="c-co">Company name*</label><input data-testid="contact-company" id="c-co" name="company" type="text" autocomplete="organization" required></div>
      <div class="field"><label for="c-email">Email*</label><input data-testid="contact-email" id="c-email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="c-phone">Phone number*</label><input data-testid="contact-phone" id="c-phone" name="phone" type="tel" autocomplete="tel" required></div>
      <div class="field"><label for="c-msg">Message (optional)</label><textarea data-testid="contact-message" id="c-msg" name="message" rows="4"></textarea></div>
      <button data-testid="contact-submit" class="btn btn-primary" type="submit">Send Message</button>
      <p class="form-note">We'll only use your details to reply to this enquiry.</p>
    </form>
  </div>
</section>

</main>

<footer class="footer">
  <div class="wrap footer-in">
    <img src="/images/quick-wing-logo-wide.png" alt="Quick Wing" style="height:48px;width:auto">
    <nav aria-label="Footer">
      <a href="https://quick-wing.com/contact">Contact</a>
      <a href="https://quick-wing.com/login">Login</a>
      <a href="https://quick-wing.com/privacy-policy">Privacy Policy</a>
      <a href="https://youtu.be/_oR2ROeUOp4">AI Six Podcast</a>
    </nav>
    <small style="text-align:right;line-height:1.5">Quick Wing · Est. 2025 · A product of QuickFleet Limited<br>© 2026 QuickFleet Limited. All rights reserved.</small>
  </div>
</footer>`;

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AUTOMATION = 0.73; // up to 73% of fleet admin automated (Sept 2026)

const SUCCESS_HTML = [
  '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin:0 auto"><circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.6 2.6L16 9.5"/></svg>',
  '<b style="font-size:22px;font-weight:800">Message sent</b>',
  '<p style="margin:0;font-size:16px;line-height:1.6;color:#3B4866">Thanks — your enquiry is on its way to Lee. He’ll personally get back to you.</p>',
].join('');

const eur = (n) => (n < 0 ? '−€' : '€') + Math.abs(Math.round(n)).toLocaleString('en-IE');

const LandingPage = () => {
  const rootRef = useRef(null);
  const priceRef = useRef(6.5);

  // html-level rules (smooth anchor scrolling + scroll padding) while mounted
  useEffect(() => {
    document.documentElement.classList.add('qw-home');
    return () => document.documentElement.classList.remove('qw-home');
  }, []);

  const calc = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const v = root.querySelector('#roi-v');
    const h = root.querySelector('#roi-h');
    const r = root.querySelector('#roi-r');
    if (!v || !h || !r) return;
    const saved = (h.value * 52) / 12 * AUTOMATION;
    const value = saved * r.value;
    const cost = v.value * priceRef.current;
    root.querySelector('#o-v').textContent = v.value;
    root.querySelector('#o-h').textContent = `${h.value} h`;
    root.querySelector('#o-r').textContent = `€${r.value}`;
    root.querySelector('#r-hours').textContent = Math.round(saved);
    root.querySelector('#r-value').textContent = eur(value);
    root.querySelector('#r-cost').textContent = eur(cost);
    root.querySelector('#r-net').textContent = eur(value - cost);
  }, []);

  const onClick = (e) => {
    const root = rootRef.current;
    const target = e.target;
    if (!root || !target.closest) return;

    const menuBtn = target.closest('.menu-btn');
    const menu = root.querySelector('#mobile-menu');
    if (menuBtn && menu) {
      const open = menu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (target.closest('#mobile-menu a') && menu) {
      menu.classList.remove('open');
      root.querySelector('.menu-btn')?.setAttribute('aria-expanded', 'false');
      return;
    }

    const tab = target.closest('.tab');
    if (tab) {
      const img = root.querySelector('#tab-img');
      root.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');
      img.src = tab.dataset.img;
      img.alt = tab.dataset.alt;
      return;
    }

    const plan = target.closest('.plan-btns .btn');
    if (plan) {
      root.querySelectorAll('.plan-btns .btn').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      plan.setAttribute('aria-pressed', 'true');
      priceRef.current = parseFloat(plan.dataset.price);
      calc();
    }
  };

  const onInput = (e) => {
    if (e.target.matches('input[type=range]')) calc();
  };

  const onSubmit = async (e) => {
    if (e.target.id !== 'contact-form') return;
    e.preventDefault();
    const root = rootRef.current;
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const val = (id) => (root.querySelector(id)?.value || '').trim();
    const payload = {
      name: val('#c-name'),
      company: val('#c-co'),
      email: val('#c-email'),
      phone: val('#c-phone'),
      message: val('#c-msg') || null,
      type: 'general',
    };
    if (!payload.name || !payload.company || !payload.email || !payload.phone) {
      form.reportValidity();
      return;
    }
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await axios.post(`${API}/public/contact`, payload);
      const panel = document.createElement('div');
      panel.className = 'form';
      panel.setAttribute('data-testid', 'landing-contact-success');
      panel.setAttribute('role', 'status');
      panel.style.cssText = 'justify-content:center;text-align:center;gap:14px';
      panel.innerHTML = SUCCESS_HTML;
      form.replaceWith(panel);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = original;
      const note = form.querySelector('.form-note');
      if (note) note.textContent = 'Something went wrong — please email Lee@quick-wing.com instead.';
    }
  };

  return (
    <>
      <style>{LANDING_CSS}</style>
      <div
        id="qw-landing"
        ref={rootRef}
        onClick={onClick}
        onInput={onInput}
        onSubmit={onSubmit}
        dangerouslySetInnerHTML={{ __html: LANDING_HTML }}
      />
    </>
  );
};

export default LandingPage;
