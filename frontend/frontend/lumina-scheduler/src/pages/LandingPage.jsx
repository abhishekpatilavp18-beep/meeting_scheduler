import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Globe, MousePointer2, ArrowRight, Check, Star } from 'lucide-react';
import ScrollAnimationSection from '../components/ScrollAnimationSection';
import Particles from '../components/Particles';
import GradientText from '../components/GradientText';
import LightPillar from '../components/LightPillar';
import UserFeedback from '../components/UserFeedback';

const features = [
  { icon: <Shield size={24} />, title: 'Enterprise Security', desc: 'End-to-end encrypted scheduling with SOC2 compliance and full data ownership.' },
  { icon: <Zap size={24} />, title: 'AI-Powered', desc: 'Intelligent availability detection that learns your preferences over time.' },
  { icon: <Globe size={24} />, title: 'Global Timezone', desc: 'Automatically resolves conflicts across any timezone in the world.' },
  { icon: <MousePointer2 size={24} />, title: 'One-Click Booking', desc: 'Share a single link. Guests pick a time. Done. No back-and-forth.' },
];

const plans = [
  { name: 'Free', price: '$0', features: ['5 event types', '1 calendar', 'Basic analytics', 'Email reminders'], cta: 'Get Started', highlight: false },
  { name: 'Pro', price: '$12', period: '/mo', features: ['Unlimited event types', 'All calendars', 'Advanced analytics', 'Zoom & Meet integration', 'Custom branding', 'Priority support'], cta: 'Start Free Trial', highlight: true },
  { name: 'Team', price: '$20', period: '/user/mo', features: ['Everything in Pro', 'Team scheduling', 'Round-robin routing', 'Admin dashboard', 'SSO / SAML'], cta: 'Contact Sales', highlight: false },
];



const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing">

      {/* ── PARTICLES BACKGROUND ── */}
      <div className="beams-bg">
        <Particles
          particleColors={["#0ea5e9", "#6366f1", "#2dd4bf"]}
          particleCount={400}
          particleSpread={20}
          speed={0.15}
          particleBaseSize={600}
          moveParticlesOnHover={true}
          alphaParticles={true}
          disableRotation={false}
        />
        <LightPillar
          topColor="#0ea5e9"
          bottomColor="#6366f1"
          intensity={0.85}
          rotationSpeed={0.2}
          pillarWidth={2.5}
          glowAmount={0.006}
          mixBlendMode="screen"
        />
      </div>

      {/* ── HERO ── */}
      <section className="hero">
        <motion.div className="hero-text" variants={container} initial="hidden" animate="show">
          <motion.div variants={item} className="pill glass-card">
            <span className="pill-dot" /> HACKHIVE-2k26 &nbsp;·&nbsp; Best Productivity Tool
          </motion.div>
          <motion.h1 variants={item} className="hero-title">
            <GradientText
              colors={["#0ea5e9", "#6366f1", "#2dd4bf", "#0ea5e9"]}
              animationSpeed={6}
              showBorder={false}
            >
              Smart Scheduling,<br />Beautifully Simple.
            </GradientText>
          </motion.h1>
          <motion.p variants={item} className="hero-sub">
            Kite Premium Scheduler eliminates the back-and-forth of scheduling meetings.
            Share a link, let guests pick a time — automated and elegant.
          </motion.p>
          <motion.div variants={item} className="hero-cta">
            <button className="btn-primary btn-xl" onClick={() => navigate('/dashboard')}>
              Start for Free <ArrowRight size={18} />
            </button>
            <button className="btn-ghost btn-xl" onClick={() => navigate('/book/me')}>
              See Live Demo
            </button>
          </motion.div>
          <motion.p variants={item} className="hero-note">No credit card required · Free forever plan</motion.p>
        </motion.div>

        <motion.div
          className="hero-image-wrap"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.9 }}
        >
          <div className="hero-img-card glass-card">
            <img src="/hero.png" alt="Kite Scheduler preview" className="hero-img" />
            <div className="hero-img-overlay" />
          </div>

          <div className="floating-badge glass-card fb-2">
            <Zap size={14} fill="var(--primary)" color="var(--primary)" /> 3 meetings booked today
          </div>
        </motion.div>
      </section>

      {/* ── LOGOS ── */}
      <section className="logos-strip">
        <p className="logos-label">Trusted by teams at</p>
        <div className="logos-row">
          {['Google', 'Notion', 'Linear', 'Vercel', 'Stripe', 'Figma'].map(l => (
            <span key={l} className="logo-name">{l}</span>
          ))}
        </div>
      </section>

      {/* ── SCROLL ANIMATION SHOWCASE ── */}
      <ScrollAnimationSection />

      {/* ── FEATURES ── */}
      <section className="features-section">
        <motion.div
          className="section-label"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          WHY KITE
        </motion.div>
        <motion.h2
          className="section-title"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        >
          Everything you need, nothing you don't.
        </motion.h2>
        <motion.div
          className="features-grid"
          variants={container} initial="hidden" whileInView="show" viewport={{ once: true }}
        >
          {features.map((f, i) => (
            <motion.div key={i} variants={item} whileHover={{ y: -8 }} className="feature-card glass-card">
              <div className="feature-icon-wrap">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="how-section">
        <motion.div className="section-label" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>HOW IT WORKS</motion.div>
        <motion.h2 className="section-title" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>Three steps to zero scheduling friction.</motion.h2>
        <div className="steps-row">
          {[
            { n: '01', title: 'Set Availability', desc: 'Define when you\'re open for meetings. Block off time, set buffers, and connect your calendars.' },
            { n: '02', title: 'Share Your Link', desc: 'Get a gorgeous, branded booking page. Send it anywhere — email, DM, your website.' },
            { n: '03', title: 'Get Scheduled', desc: 'Guests pick a slot. Meeting is confirmed, calendar updated, and video link generated — instantly.' },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="step-card glass-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <span className="step-number">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── USER FEEDBACK ── */}
      <UserFeedback />

      {/* ── PRICING ── */}
      <section className="pricing-section">
        <motion.div className="section-label" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>PRICING</motion.div>
        <motion.h2 className="section-title" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>Simple, transparent pricing.</motion.h2>
        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              className={`pricing-card glass-card ${plan.highlight ? 'highlight' : ''}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -6 }}
            >
              {plan.highlight && <div className="popular-badge">Most Popular</div>}
              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price">
                <span className="price-value">{plan.price}</span>
                {plan.period && <span className="price-period">{plan.period}</span>}
              </div>
              <ul className="plan-features">
                {plan.features.map((f, fi) => (
                  <li key={fi}><Check size={16} className="check-icon" />{f}</li>
                ))}
              </ul>
              <button
                className={plan.highlight ? 'btn-primary btn-full' : 'btn-ghost btn-full'}
                onClick={() => navigate('/dashboard')}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="cta-banner glass-card">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2>Ready to reclaim your time?</h2>
          <p>Join 50,000+ professionals scheduling smarter with Kite.</p>
          <button className="btn-primary btn-xl" onClick={() => navigate('/dashboard')}>
            Get Started — It's Free <ArrowRight size={18} />
          </button>
        </motion.div>
      </section>

      <style>{`
        .landing { padding-bottom: 6rem; position: relative; background: var(--background); color: var(--text); }
        .beams-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100vh; z-index: 0; pointer-events: none; opacity: 1.0; }
        .landing > section, .landing > .cta-banner { position: relative; z-index: 1; }

        /* HERO */
        .hero { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; padding: 3rem 0 6rem; }
        .pill { display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.4rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600; color: var(--primary); margin-bottom: 1.5rem; background: rgba(255,255,255,0.05); }
        .pill-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981; flex-shrink: 0; }
        .hero-title { font-size: clamp(2.5rem, 4vw, 3.8rem); line-height: 1.1; margin-bottom: 1.5rem; color: #fff; }
        .hero-sub { color: rgba(255,255,255,0.7); font-size: 1.15rem; line-height: 1.7; margin-bottom: 2rem; max-width: 520px; }
        .hero-cta { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .btn-ghost { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: #fff; }
        .hero-note { color: rgba(255,255,255,0.7); font-size: 0.85rem; }
        .hero-image-wrap { position: relative; }
        .hero-img-card { border-radius: 28px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.5); position: relative; border: 1px solid rgba(255,255,255,0.1); }
        .hero-img { width: 100%; height: auto; display: block; }
        .hero-img-overlay { position: absolute; inset: 0; background: linear-gradient(135deg, var(--primary-glow) 0%, var(--secondary-glow) 100%); pointer-events: none; }
        .floating-badge { position: absolute; display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600; backdrop-filter: blur(10px); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); }
        .fb-1 { top: -16px; right: 20px; color: #10b981; }
        .fb-2 { bottom: -16px; left: 20px; color: var(--primary); }

        /* LOGOS */
        .logos-strip { padding: 4rem 0; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); }
        .logos-label { text-align: center; font-size: 0.9rem; color: #fff; margin-bottom: 2rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.8; }
        .logos-row { display: flex; justify-content: center; align-items: center; gap: 4rem; flex-wrap: wrap; opacity: 0.8; }
        .logo-name { font-size: 1.5rem; font-weight: 800; color: #fff; letter-spacing: -0.02em; }

        /* SECTIONS */
        .features-section, .how-section, .testimonials-section, .pricing-section { padding: 8rem 0; }
        .section-label { color: #fff; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 1rem; text-align: center; opacity: 0.9; }
        .section-title { font-size: clamp(2rem, 3vw, 2.8rem); text-align: center; margin-bottom: 4rem; color: #fff; }
        
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 2rem; }
        .feature-card { padding: 2.5rem; border-radius: 24px; transition: all 0.3s ease; background: rgba(255,255,255,0.03); }
        .feature-icon-wrap { width: 56px; height: 56px; border-radius: 16px; background: rgba(59,130,246,0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
        .feature-card h3 { font-size: 1.25rem; margin-bottom: 0.75rem; color: #fff; }
        .feature-card p { color: rgba(255,255,255,0.6); line-height: 1.6; }

        .steps-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
        .step-card { padding: 3rem; position: relative; overflow: hidden; background: rgba(255,255,255,0.03); }
        .step-number { position: absolute; top: 1.5rem; right: 1.5rem; font-size: 4rem; font-weight: 900; opacity: 0.05; color: #fff; line-height: 1; }
        .step-card h3 { font-size: 1.5rem; margin-bottom: 1rem; color: #fff; }
        .step-card p { color: rgba(255,255,255,0.6); line-height: 1.6; }



        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
        .pricing-card { padding: 3rem; display: flex; flex-direction: column; background: rgba(255,255,255,0.03); }
        .pricing-card.highlight { border: 2px solid var(--primary); background: rgba(59,130,246,0.05); }
        .plan-name { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: #fff; }
        .plan-price { margin-bottom: 2rem; }
        .price-value { font-size: 3rem; font-weight: 800; color: #fff; }
        .price-period { color: rgba(255,255,255,0.5); font-size: 1.1rem; }
        .plan-features { list-style: none; margin-bottom: 2.5rem; flex: 1; }
        .plan-features li { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; color: rgba(255,255,255,0.7); }
        .check-icon { color: #10b981; }
        .btn-full { width: 100%; justify-content: center; padding: 1rem; }

        .cta-banner { padding: 6rem; text-align: center; border-radius: 40px; background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1)); border: 1px solid rgba(255,255,255,0.1); }
        .cta-banner h2 { font-size: 3rem; margin-bottom: 1.5rem; color: #fff; }
        .cta-banner p { font-size: 1.2rem; color: rgba(255,255,255,0.7); margin-bottom: 2.5rem; }

        /* BUTTON VARIANTS */
        .btn-xl { padding: 1rem 2rem; font-size: 1rem; display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 14px; font-weight: 700; }

        @media (max-width: 1024px) {
          .hero { grid-template-columns: 1fr; }
          .hero-image-wrap { display: none; }
          .steps-row { grid-template-columns: 1fr; }
          .testimonials-grid { grid-template-columns: 1fr; }
          .pricing-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
