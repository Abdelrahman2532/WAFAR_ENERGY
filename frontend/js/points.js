/**
 * WAFAR Points & Bill Discount Controller
 */

let pointsData = null;
let pointsError = false;
const POINTS_PER_EGP = 10;
const POINTS_MILESTONE = 100;

document.addEventListener('DOMContentLoaded', async () => {
  await initPointsPage();

  window.addEventListener('wafar:langchange', () => {
    renderPointsUI();
  });
});

async function initPointsPage() {
  pointsError = false;

  try {
    if (
      typeof PointsAPI !== 'undefined' &&
      typeof PointsAPI.getPointsSummary === 'function'
    ) {
      const loaded = await PointsAPI.getPointsSummary();
      if (loaded && typeof loaded === 'object') {
        pointsData = loaded;
      }
    }
  } catch (error) {
    console.warn('Points API unavailable:', error);
    pointsError = true;
  }

  if (!pointsData || typeof pointsData !== 'object') {
    pointsData = getDefaultPointsData();
  }

  normalizePointsData();
  renderPointsUI();
  setupRedeemButton();
}

function getDefaultPointsData() {
  return {
    points: 80,
    discountEGP: 8,
    totalPointsEarned: 240,
    energySaved: 32,
    history: [
      {
        action: 'Reduced electricity consumption',
        description: 'Saved 2.4 kWh today',
        date: 'Today',
        points: 12,
        egpValue: '1.20 EGP',
        icon: '⚡'
      },
      {
        action: 'Turned off unused lamp',
        description: 'Lamp was switched off',
        date: 'Yesterday',
        points: 5,
        egpValue: '0.50 EGP',
        icon: '💡'
      },
      {
        action: 'Below average consumption',
        description: 'Daily usage was below your average',
        date: 'Aug 29',
        points: 20,
        egpValue: '2.00 EGP',
        icon: '🌱'
      },
      {
        action: 'Energy saving target',
        description: 'Completed your daily saving goal',
        date: 'Aug 27',
        points: 10,
        egpValue: '1.00 EGP',
        icon: '🏆'
      }
    ]
  };
}

function normalizePointsData() {
  if (!pointsData || typeof pointsData !== 'object') {
    return;
  }

  pointsData.points = parsePointsAmount(pointsData.points, 0);
  pointsData.discountEGP = pointsData.points / POINTS_PER_EGP;

  const history = Array.isArray(pointsData.history) ? pointsData.history : [];
  pointsData.history = history.map((item, index) => ({
    id: item && item.id ? item.id : `point-${index + 1}`,
    action: item && item.action ? String(item.action) : getLocalizedText('points_history_default_action'),
    description: item && item.description ? String(item.description) : '',
    date: item && item.date ? String(item.date) : '',
    points: parsePointsAmount(item && item.points, 0),
    egpValue: typeof item?.egpValue === 'string' && item.egpValue.trim()
      ? item.egpValue
      : `${(parsePointsAmount(item && item.points, 0) / POINTS_PER_EGP).toFixed(2)} EGP`,
    icon: item && item.icon ? item.icon : '⭐'
  }));
}

function renderPointsUI() {
  if (!pointsData || typeof pointsData !== 'object') return;

  const points = parsePointsAmount(pointsData.points, 0);
  const discount = points / POINTS_PER_EGP;
  const history = getNormalizedHistory();
  const totalEarned = history.reduce((sum, item) => sum + parsePointsAmount(item.points, 0), 0);
  const transactionCount = history.length;
  const averagePoints = transactionCount ? totalEarned / transactionCount : 0;

  setText('pointsBalanceVal', formatNumber(points));
  setText('discountValDisplay', `${discount.toFixed(2)} EGP`);

  const sidebarPoints = document.getElementById('sidebarPoints');
  if (sidebarPoints) {
    sidebarPoints.textContent = `${formatNumber(points)} pts`;
  }

  setText('totalPointsEarned', formatNumber(totalEarned));
  setText('pointsTransactions', String(transactionCount));
  setText('averagePoints', averagePoints.toFixed(1));

  const redeemPoints = document.getElementById('redeemPoints');
  if (redeemPoints) {
    redeemPoints.textContent = `${formatNumber(points)} pts`;
  }

  const redeemDiscount = document.getElementById('redeemDiscount');
  if (redeemDiscount) {
    redeemDiscount.textContent = `${discount.toFixed(2)} EGP`;
  }

  const chartTotal = document.getElementById('chartTotal');
  if (chartTotal) {
    chartTotal.textContent = formatNumber(points);
  }

  updateProgress(points);
  renderHistoryTable();
}

function updateProgress(points) {
  const progressFill = document.getElementById('pointsProgressFill');
  const progressValue = document.getElementById('pointsProgressValue');
  const nextReward = document.getElementById('pointsNextReward');

  const safePoints = Math.max(0, parsePointsAmount(points, 0));
  const progress = Math.min((safePoints / POINTS_MILESTONE) * 100, 100);
  const remaining = Math.max(POINTS_MILESTONE - safePoints, 0);

  if (progressFill) {
    requestAnimationFrame(() => {
      progressFill.style.width = `${progress}%`;
    });
  }

  if (progressValue) {
    progressValue.textContent = `${Math.round(progress)}%`;
  }

  if (nextReward) {
    if (remaining > 0) {
      nextReward.textContent = `${formatNumber(remaining)} ${getLocalizedText('points_progress_remaining')}`;
    } else {
      nextReward.textContent = getLocalizedText('points_progress_completed');
    }
  }
}

function renderHistoryTable() {
  const tbody = document.getElementById('pointsHistoryTbody');
  if (!tbody) return;

  const history = getNormalizedHistory();

  if (pointsError) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="points-error-state">
            <div class="points-error-state-icon">⚠️</div>
            <h3>${getLocalizedText('points_error_title')}</h3>
            <p>${getLocalizedText('points_error_description')}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  if (!history.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="points-empty-state">
            <div class="points-empty-state-icon">⚡</div>
            <h3>${getLocalizedText('points_empty_title')}</h3>
            <p>${getLocalizedText('points_empty_description')}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.map((item) => {
    const earned = parsePointsAmount(item.points, 0);
    const egpValue = formatEgpValue(item.egpValue, earned);
    const action = item.action ? String(item.action) : getLocalizedText('points_history_default_action');

    return `
      <tr class="points-history-row">
        <td class="points-history-action">${escapeHTML(action)}</td>
        <td>${escapeHTML(item.date || '-')}</td>
        <td class="points-history-points">+${formatNumber(earned)} pts</td>
        <td class="points-history-egp">${escapeHTML(egpValue)}</td>
      </tr>
    `;
  }).join('');
}

function addPoints(amount, action = 'Energy saving') {
  if (!pointsData || typeof pointsData !== 'object') {
    pointsData = getDefaultPointsData();
  }

  const pointsToAdd = parsePointsAmount(amount, 0);
  if (pointsToAdd <= 0) {
    return {
      success: false,
      points: parsePointsAmount(pointsData.points, 0),
      discountEGP: parsePointsAmount(pointsData.points, 0) / POINTS_PER_EGP
    };
  }

  const currentPoints = parsePointsAmount(pointsData.points, 0);
  pointsData.points = currentPoints + pointsToAdd;
  pointsData.discountEGP = pointsData.points / POINTS_PER_EGP;

  const entry = {
    id: `manual-${Date.now()}`,
    action: action || getLocalizedText('points_history_default_action'),
    description: '',
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    points: pointsToAdd,
    egpValue: `${(pointsToAdd / POINTS_PER_EGP).toFixed(2)} EGP`,
    icon: '⚡'
  };

  pointsData.history = [entry, ...(Array.isArray(pointsData.history) ? pointsData.history : [])];
  pointsError = false;
  renderPointsUI();

  return {
    success: true,
    points: pointsData.points,
    discountEGP: pointsData.discountEGP,
    history: pointsData.history
  };
}

window.addPoints = addPoints;

function setupRedeemButton() {
  const button = document.getElementById('redeemBtn');
  if (!button) return;

  button.addEventListener('click', () => {
    const points = parsePointsAmount(pointsData && pointsData.points, 0);
    const discount = points / POINTS_PER_EGP;

    if (points < POINTS_PER_EGP) {
      showToast(getLocalizedText('points_redeem_minimum'), 'warning');
      return;
    }

    showToast(`${discount.toFixed(2)} EGP discount will be applied to your next bill.`, 'success');
  });
}

function showToast(message, type = 'success') {
  const container = document.querySelector('.toast-container');
  if (!container) {
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `wafar-points-toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠'}</span>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

function getNormalizedHistory() {
  if (!pointsData || typeof pointsData !== 'object') return [];

  const history = Array.isArray(pointsData.history) ? pointsData.history : [];

  return history
    .map((item) => ({
      id: item && item.id ? item.id : '',
      action: item && item.action ? String(item.action) : '',
      description: item && item.description ? String(item.description) : '',
      date: item && item.date ? String(item.date) : '',
      points: parsePointsAmount(item && item.points, 0),
      egpValue: item && item.egpValue ? String(item.egpValue) : '',
      icon: item && item.icon ? item.icon : '⭐'
    }))
    .filter((item) => parsePointsAmount(item.points, 0) > 0 || item.action || item.date);
}

function parsePointsAmount(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : fallback;
  }

  return fallback;
}

function formatNumber(value) {
  const safeValue = Number(value) || 0;
  return new Intl.NumberFormat().format(Math.round(safeValue));
}

function formatEgpValue(value, pointsEarned) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  const computed = (Number(pointsEarned) || 0) / POINTS_PER_EGP;
  return `${computed.toFixed(2)} EGP`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getLocalizedText(key) {
  if (typeof i18n !== 'undefined' && i18n && typeof i18n.t === 'function') {
    return i18n.t(key);
  }

  const fallback = {
    points_history_default_action: 'Energy saving',
    points_progress_remaining: 'points to next milestone',
    points_progress_completed: 'Milestone reached!',
    points_empty_title: 'No points yet',
    points_empty_description: 'Save electricity and earn points for your next bill discount.',
    points_error_title: 'Unable to load points history',
    points_error_description: 'Please refresh the page or try again later.',
    points_redeem_minimum: 'You need at least 10 points to redeem a discount.'
  };

  return fallback[key] || key;
}
