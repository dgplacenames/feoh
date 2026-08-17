import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function fmtMoney(n) {
  const neg = n < 0;
  const v = '£' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? '-' + v : v;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function fmtDateLong(d) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userEmailEl = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = {
  current: document.getElementById('tab-current'),
  newperiod: document.getElementById('tab-newperiod'),
  archive: document.getElementById('tab-archive'),
};

const balanceAmountEl = document.getElementById('balance-amount');
const balanceSubEl = document.getElementById('balance-sub');
const periodDatesEl = document.getElementById('period-dates');

const purchaseForm = document.getElementById('purchase-form');
const itemInput = document.getElementById('item-input');
const priceInput = document.getElementById('price-input');
const purchaseError = document.getElementById('purchase-error');
const currentPurchaseList = document.getElementById('current-purchase-list');

const newPeriodForm = document.getElementById('new-period-form');
const newPeriodDate = document.getElementById('new-period-date');
const newPeriodAmount = document.getElementById('new-period-amount');
const newPeriodError = document.getElementById('new-period-error');

const archiveList = document.getElementById('archive-list');

const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');

function confirmAction(title, message, onConfirm) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  show(confirmModal);

  const cleanup = () => {
    hide(confirmModal);
    confirmOkBtn.removeEventListener('click', onOk);
    confirmCancelBtn.removeEventListener('click', onCancel);
  };
  const onOk = () => { cleanup(); onConfirm(); };
  const onCancel = () => cleanup();

  confirmOkBtn.addEventListener('click', onOk);
  confirmCancelBtn.addEventListener('click', onCancel);
}

let currentPeriod = null;
let currentPurchases = [];
let allPeriods = [];

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hide(loginError);
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = error.message;
    show(loginError);
  }
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    hide(loginScreen);
    show(appScreen);
    userEmailEl.textContent = session.user.email;
    loadEverything();
  } else {
    show(loginScreen);
    hide(appScreen);
  }
});

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;

    Object.entries(tabPanels).forEach(([key, panel]) => {
      if (key === target) show(panel); else hide(panel);
    });

    if (target === 'newperiod') {
      hide(newPeriodError);
      newPeriodDate.value = new Date().toISOString().slice(0, 10);
      newPeriodAmount.value = currentPeriod ? currentPeriod.starting_amount : '';
    }
    if (target === 'archive') {
      renderArchive();
    }
  });
});

async function loadEverything() {
  const { data: periods, error } = await supabase
    .from('periods')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  allPeriods = periods || [];
  currentPeriod = allPeriods[0] || null;

  if (!currentPeriod) {
    renderNoPeriod();
    return;
  }

  await loadCurrentPurchases();
  renderCurrent();
}

async function loadCurrentPurchases() {
  if (!currentPeriod) return;
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('period_id', currentPeriod.id)
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  currentPurchases = data || [];
}

function renderNoPeriod() {
  balanceAmountEl.textContent = '--';
  balanceSubEl.textContent = '';
  periodDatesEl.textContent = 'No pay period set up yet.';
  currentPurchaseList.innerHTML = '';
  const note = document.createElement('p');
  note.className = 'empty-note';
  note.textContent = 'Go to the "New period" tab to begin.';
  currentPurchaseList.appendChild(note);
}

function renderCurrent() {
  const spent = currentPurchases.reduce((sum, p) => sum + Number(p.price), 0);
  const remaining = Number(currentPeriod.starting_amount) - spent;

  balanceAmountEl.textContent = fmtMoney(remaining);
  balanceAmountEl.classList.toggle('negative', remaining < 0);
  balanceSubEl.textContent = `${fmtMoney(spent)} spent of ${fmtMoney(currentPeriod.starting_amount)}`;
  periodDatesEl.textContent = `Period started ${fmtDateLong(currentPeriod.start_date)}`;

  currentPurchaseList.innerHTML = '';
  if (currentPurchases.length === 0) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = 'No purchases logged this period yet.';
    currentPurchaseList.appendChild(note);
    return;
  }

  currentPurchases.forEach((p) => {
    currentPurchaseList.appendChild(buildPurchaseRow(p, true));
  });
}

function buildPurchaseRow(p, deletable) {
  const row = document.createElement('div');
  row.className = 'purchase-row';

  const left = document.createElement('div');
  const name = document.createElement('p');
  name.className = 'item-name';
  name.textContent = p.item;
  const date = document.createElement('p');
  date.className = 'item-date';
  date.textContent = fmtDate(p.created_at);
  left.appendChild(name);
  left.appendChild(date);

  const right = document.createElement('div');
  right.className = 'row-right';
  const price = document.createElement('span');
  price.className = 'price';
  price.textContent = fmtMoney(Number(p.price));
  right.appendChild(price);

  if (deletable) {
    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.innerHTML = '&#10005;';
    del.setAttribute('aria-label', 'Delete purchase');
    del.addEventListener('click', () => {
      confirmAction(
        'Delete purchase?',
        `Remove "${p.item}" (${fmtMoney(Number(p.price))}) from this period. This can't be undone.`,
        () => deletePurchase(p.id)
      );
    });
    right.appendChild(del);
  }

  row.appendChild(left);
  row.appendChild(right);
  return row;
}

purchaseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hide(purchaseError);

  if (!currentPeriod) {
    purchaseError.textContent = 'Start a pay period first.';
    show(purchaseError);
    return;
  }

  const item = itemInput.value.trim();
  const price = parseFloat(priceInput.value);

  if (!item || isNaN(price) || price <= 0) {
    purchaseError.textContent = 'Enter an item and a price above 0.';
    show(purchaseError);
    return;
  }

  const { error } = await supabase
    .from('purchases')
    .insert({ period_id: currentPeriod.id, item, price });

  if (error) {
    purchaseError.textContent = error.message;
    show(purchaseError);
    return;
  }

  itemInput.value = '';
  priceInput.value = '';
  itemInput.focus();
  await loadCurrentPurchases();
  renderCurrent();
});

async function deletePurchase(id) {
  const { error } = await supabase.from('purchases').delete().eq('id', id);
  if (error) {
    console.error(error);
    return;
  }
  await loadCurrentPurchases();
  renderCurrent();
}

newPeriodForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hide(newPeriodError);

  const start_date = newPeriodDate.value;
  const starting_amount = parseFloat(newPeriodAmount.value);

  if (!start_date || isNaN(starting_amount) || starting_amount < 0) {
    newPeriodError.textContent = 'Enter a valid date and starting amount.';
    show(newPeriodError);
    return;
  }

  confirmAction(
    'Start new pay period?',
    `This archives the current period and starts a fresh balance of ${fmtMoney(starting_amount)} from ${fmtDateLong(start_date)}.`,
    async () => {
      const { error } = await supabase
        .from('periods')
        .insert({ start_date, starting_amount });

      if (error) {
        newPeriodError.textContent = error.message;
        show(newPeriodError);
        return;
      }

      await loadEverything();
      document.querySelector('.tab-btn[data-tab="current"]').click();
    }
  );
});

async function renderArchive() {
  archiveList.innerHTML = '';
  const pastPeriods = allPeriods.filter((p) => currentPeriod && p.id !== currentPeriod.id);

  if (pastPeriods.length === 0) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = 'No past periods yet.';
    archiveList.appendChild(note);
    return;
  }

  for (const period of pastPeriods) {
    const wrapper = document.createElement('div');
    wrapper.className = 'archive-period';

    const header = document.createElement('button');
    header.className = 'archive-period-header';

    const leftSpan = document.createElement('span');
    leftSpan.innerHTML = `Period from ${fmtDate(period.start_date)}<span class="dates">Starting ${fmtMoney(Number(period.starting_amount))}</span>`;

    const totalsSpan = document.createElement('span');
    totalsSpan.className = 'totals';
    totalsSpan.textContent = '...';

    header.appendChild(leftSpan);
    header.appendChild(totalsSpan);

    const body = document.createElement('div');
    body.className = 'archive-period-body hidden';

    header.addEventListener('click', async () => {
      const isHidden = body.classList.contains('hidden');
      if (isHidden && body.dataset.loaded !== 'true') {
        const { data, error } = await supabase
          .from('purchases')
          .select('*')
          .eq('period_id', period.id)
          .order('created_at', { ascending: false });
        if (!error) {
          const spent = (data || []).reduce((sum, p) => sum + Number(p.price), 0);
          totalsSpan.textContent = `${fmtMoney(spent)} spent`;
          body.innerHTML = '';
          if ((data || []).length === 0) {
            const note = document.createElement('p');
            note.className = 'empty-note';
            note.textContent = 'No purchases in this period.';
            body.appendChild(note);
          } else {
            data.forEach((p) => body.appendChild(buildPurchaseRow(p, false)));
          }
          body.dataset.loaded = 'true';
        }
      }
      body.classList.toggle('hidden');
    });

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    archiveList.appendChild(wrapper);
    supabase
      .from('purchases')
      .select('price')
      .eq('period_id', period.id)
      .then(({ data, error }) => {
        if (!error) {
          const spent = (data || []).reduce((sum, p) => sum + Number(p.price), 0);
          totalsSpan.textContent = `${fmtMoney(spent)} spent`;
        }
      });
  }
}
