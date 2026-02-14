/**
 * Neural Galaxy — Interactive canvas animation for Voyage Tracable hero.
 *
 * Renders a living neural-network graph with three colored hub nodes
 * (one per venture) connected by drifting ambient particles.
 */

interface HubNode {
  /** Fractional position (0-1) relative to canvas */
  fx: number;
  fy: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  glowColor: string;
  label: string;
  pulsePhase: number;
}

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export function initNeuralGalaxy(canvas: HTMLCanvasElement, container: HTMLElement) {
  const ctx = canvas.getContext('2d')!;
  let mouse = { x: -1000, y: -1000 };
  let particles: Particle[] = [];
  let animationId: number;
  let stopped = false;

  // Check reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hub definitions — positioned in a triangle
  const hubs: HubNode[] = [
    {
      fx: 0.25, fy: 0.35,
      x: 0, y: 0, radius: 8,
      color: '#DAA520', glowColor: 'rgba(218, 165, 32, ',
      label: 'Publishing',
      pulsePhase: 0,
    },
    {
      fx: 0.75, fy: 0.35,
      x: 0, y: 0, radius: 8,
      color: '#10B981', glowColor: 'rgba(16, 185, 129, ',
      label: 'Inspired Mile',
      pulsePhase: 2,
    },
    {
      fx: 0.5, fy: 0.72,
      x: 0, y: 0, radius: 8,
      color: '#4D7CFF', glowColor: 'rgba(77, 124, 255, ',
      label: 'PlayDimension',
      pulsePhase: 4,
    },
  ];

  function resize() {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Reposition hubs
    for (const hub of hubs) {
      hub.x = hub.fx * rect.width;
      hub.y = hub.fy * rect.height;
    }

    initParticles();
  }

  function initParticles() {
    const w = canvas.width / Math.min(devicePixelRatio, 2);
    const h = canvas.height / Math.min(devicePixelRatio, 2);
    const count = Math.min(Math.floor((w * h) / 5000), 200);
    particles = [];

    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      particles.push({
        x, y, baseX: x, baseY: y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.4 + 0.15,
      });
    }
  }

  function draw(time: number) {
    if (stopped) return;

    const w = canvas.width / Math.min(devicePixelRatio, 2);
    const h = canvas.height / Math.min(devicePixelRatio, 2);
    ctx.clearRect(0, 0, w, h);

    const t = time / 1000;

    // --- Update particles ---
    for (const p of particles) {
      // Mouse attraction (gentle pull toward cursor)
      const mdx = mouse.x - p.x;
      const mdy = mouse.y - p.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < 200 && mDist > 0) {
        const force = (200 - mDist) / 200 * 0.4;
        p.vx += (mdx / mDist) * force;
        p.vy += (mdy / mDist) * force;
      }

      // Hub gravity — gentle pull toward nearby hubs
      for (const hub of hubs) {
        const hdx = hub.x - p.x;
        const hdy = hub.y - p.y;
        const hDist = Math.sqrt(hdx * hdx + hdy * hdy);
        if (hDist < 250 && hDist > 20) {
          const grav = (250 - hDist) / 250 * 0.08;
          p.vx += (hdx / hDist) * grav;
          p.vy += (hdy / hDist) * grav;
        }
      }

      // Spring return to base
      p.vx += (p.baseX - p.x) * 0.005;
      p.vy += (p.baseY - p.y) * 0.005;

      // Damping
      p.vx *= 0.96;
      p.vy *= 0.96;

      p.x += p.vx;
      p.y += p.vy;
    }

    // --- Draw particle-particle connections ---
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const alpha = (1 - dist / 120) * 0.12;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // --- Draw hub-particle connections ---
    for (const hub of hubs) {
      for (const p of particles) {
        const dx = hub.x - p.x;
        const dy = hub.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const alpha = (1 - dist / 180) * 0.2;
          ctx.strokeStyle = hub.glowColor + alpha + ')';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(hub.x, hub.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }
    }

    // --- Draw hub-hub connections (subtle) ---
    for (let i = 0; i < hubs.length; i++) {
      for (let j = i + 1; j < hubs.length; j++) {
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hubs[i].x, hubs[i].y);
        ctx.lineTo(hubs[j].x, hubs[j].y);
        ctx.stroke();
      }
    }

    // --- Draw particles ---
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha})`;
      ctx.fill();
    }

    // --- Draw hub nodes ---
    for (const hub of hubs) {
      const pulse = Math.sin(t * 1.5 + hub.pulsePhase) * 0.3 + 0.7;

      // Outer glow ring
      const glowRadius = hub.radius + 12 + Math.sin(t * 2 + hub.pulsePhase) * 4;
      const gradient = ctx.createRadialGradient(hub.x, hub.y, hub.radius, hub.x, hub.y, glowRadius);
      gradient.addColorStop(0, hub.glowColor + (0.25 * pulse) + ')');
      gradient.addColorStop(1, hub.glowColor + '0)');
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core circle
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.radius, 0, Math.PI * 2);
      ctx.fillStyle = hub.color;
      ctx.fill();

      // Inner bright spot
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * pulse})`;
      ctx.fill();

      // Label
      ctx.font = '500 13px "Space Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * pulse})`;
      ctx.fillText(hub.label, hub.x, hub.y + hub.radius + 22);
    }

    animationId = requestAnimationFrame(draw);
  }

  // --- Event listeners ---
  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  container.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  // Touch support
  container.addEventListener('touchmove', (e) => {
    const rect = container.getBoundingClientRect();
    const touch = e.touches[0];
    mouse.x = touch.clientX - rect.left;
    mouse.y = touch.clientY - rect.top;
  }, { passive: true });

  container.addEventListener('touchend', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  window.addEventListener('resize', resize);

  // --- Start ---
  resize();

  if (prefersReducedMotion) {
    // Draw one static frame
    draw(0);
  } else {
    animationId = requestAnimationFrame(draw);
  }

  // Cleanup function
  return () => {
    stopped = true;
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resize);
  };
}
