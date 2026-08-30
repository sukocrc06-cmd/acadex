const ACHIEVEMENTS_LOOKUP = {
  first_upload: { title: "İlk Adım", desc: "Uploaded your first document", icon: "📄" },
  first_summary: { title: "Özetleme Ustası", desc: "Created your first AI study card", icon: "🧠" },
  first_exam: { title: "Sınav Zamanı", desc: "Completed your first practice exam", icon: "📝" },
  perfect_score: { title: "Mükemmeliyetçi", desc: "Scored 100/100 on an exam", icon: "💯" },
  first_share: { title: "Paylaşımcı", desc: "Shared a study card with your department", icon: "🤝" },
  first_notebook_save: { title: "Defter Tutkunu", desc: "Saved your first notebook page", icon: "📓" },
  first_sandbox_project: { title: "Sandbox Kaşifi", desc: "Shared a project in the Developer Sandbox", icon: "🚀" },
  streak_7: { title: "7 Günlük Seri", desc: "Stayed active for 7 days in a row", icon: "🔥" },
  streak_30: { title: "30 Günlük Seri", desc: "Stayed active for 30 days in a row", icon: "⭐" },
  // Rozet setini genişleten yeni başarılar (hacim/süreklilik kilometre
  // taşları — mevcut first_* rozetlerin doğal devamı, aynı
  // checkAndAward* fonksiyonlarına ek sayım eşikleri olarak eklendi).
  streak_100: { title: "Demir İrade", desc: "Stayed active for 100 days in a row", icon: "🏅" },
  summary_10: { title: "Not Koleksiyoncusu", desc: "Created 10 AI study cards", icon: "📚" },
  summary_50: { title: "Bilgi Kütüphanesi", desc: "Created 50 AI study cards", icon: "🏛️" },
  exam_10: { title: "Sınav Maratoncusu", desc: "Completed 10 practice exams", icon: "🏃" },
  perfect_5: { title: "Kusursuzluk Ustası", desc: "Scored 100/100 five times", icon: "👑" },
  share_5: { title: "Cömert Paylaşımcı", desc: "Shared 5 study cards with your department", icon: "🎁" },
  notebook_10: { title: "Defter Ustası", desc: "Saved 10 notebook pages", icon: "🗂️" },
  // Awarded server-side by a Postgres trigger (see
  // supabase/migrations/20260830c_sandbox_feed_likes_comments.sql) the
  // moment one of a student's own Developer Sandbox projects crosses 5
  // likes — never awarded client-side, since the recipient is the
  // project's owner, not necessarily whoever is doing the liking.
  project_popular: { title: "Popüler Proje", desc: "One of your sandbox projects reached 5 likes", icon: "🌟" }
};

async function awardAchievement(achievementId) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const user = session.user;

    const { error } = await supabaseClient
      .from('user_achievements')
      .insert({ user_id: user.id, achievement_id: achievementId });

    if (error) {
      // Postgres unique constraint violation code is '23505'
      if (error.code === '23505') {
        return; // Silently ignore if already earned
      }
      console.error("Error inserting user achievement:", error);
      return;
    }

    // Success - newly unlocked! Show toast
    showAchievementToast(achievementId);
    
    if (typeof window.renderStreakAndAchievements === 'function') {
      window.renderStreakAndAchievements();
    }
  } catch (err) {
    console.error("Exception in awardAchievement:", err);
  }
}

function showAchievementToast(achievementId) {
  const achievement = ACHIEVEMENTS_LOOKUP[achievementId];
  if (!achievement) return;

  const container = document.getElementById('achievement-toast-container') || createAchievementToastContainer();
  
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 1rem;
    background: linear-gradient(135deg, var(--color-navy) 0%, #1a365d 100%);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: var(--radius);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.15);
    border: 2px solid var(--color-teal);
    font-family: inherit;
    z-index: 100000;
    pointer-events: auto;
    animation: achievementSlideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    width: 320px;
  `;

  toast.innerHTML = `
    <div style="font-size: 2.25rem; animation: badgeBounce 1.2s infinite alternate; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));">${achievement.icon}</div>
    <div>
      <span style="font-size: 0.7rem; text-transform: uppercase; font-weight: 800; color: var(--color-teal); letter-spacing: 0.05em; display: block; margin-bottom: 0.15rem;">🏆 Achievement Unlocked!</span>
      <strong style="font-size: 0.95rem; font-weight: 800; display: block; color: white;">${achievement.title}</strong>
      <span style="font-size: 0.75rem; color: #a0aec0; display: block; margin-top: 0.15rem;">${achievement.desc}</span>
    </div>
  `;

  container.appendChild(toast);

  playAchievementChime();

  setTimeout(() => {
    toast.style.animation = 'achievementSlideOut 0.5s ease forwards';
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 500);
  }, 5500);
}

function createAchievementToastContainer() {
  const container = document.createElement('div');
  container.id = 'achievement-toast-container';
  container.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 100000;
    pointer-events: none;
  `;
  document.body.appendChild(container);
  return container;
}

function playAchievementChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      
      gain.gain.setValueAtTime(0.2, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.45);
    });
  } catch (e) {
    console.error("Audio chime error:", e);
  }
}

window.awardAchievement = awardAchievement;
window.ACHIEVEMENTS_LOOKUP = ACHIEVEMENTS_LOOKUP;
