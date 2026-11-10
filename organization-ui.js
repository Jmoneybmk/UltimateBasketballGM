function relationshipNetwork(connections) {
  const groups = new Map();
  for (const item of connections) {
    if (!groups.has(item.type)) groups.set(item.type, []);
    groups.get(item.type).push(item);
  }
  const link = item => `<a href="${e(item.href)}">${e(item.name)}</a>`;
  return `<section><h2>Relationship map</h2><div class="panel table-wrap"><table>
    <thead><tr><th>Connection</th><th>Name</th><th>Details</th></tr></thead>
    <tbody>${[...groups].map(([type, members]) => ['Teammate', 'Shared agent'].includes(type) ? `<tr><td>${e(type === 'Teammate' ? 'Teammates' : 'Shared agent')}</td><td colspan="2">
      <details><summary>${members.length} ${type === 'Teammate' ? 'current teammates' : 'other clients'}</summary>${members.map(item => link(item) + (item.detail ? ' (' + e(item.detail) + ')' : '')).join(' · ')}</details>
      </td></tr>` : members.map(item => `<tr><td>${e(type)}</td>
        <td>${link(item)}</td><td>${e(item.detail ?? '—')}${item.source ? ` · <a href="${e(item.source)}">Source</a>` : ''}</td></tr>`).join('')).join('')}
    </tbody></table></div></section>`;
}

function relationshipDirectory(save, selected) {
  const state = seasonSim.history(save);
  const entities = worldRelationships.entities(save, state);
  const origin = entities.get(selected) ?? entities.get('GM:' + save.team);
  const kinds = [...new Set([...entities.values()].map(person => person.kind))].sort();
  operationsPage('Relationship network', 'Browse connections from any player, team, staff member, or contact. Scores reflect the franchise simulation.', `
    <p>Viewing connections from <strong>${e(origin.name)}</strong> · ${e(origin.kind)}</p>
    <div class="franchise-actions"><a href="#network">View from your GM</a></div>
    <div class="franchise-actions">
      <label>Search <input id="network-search" type="search" placeholder="Name or team code"></label>
      <label>Type <select id="network-kind"><option value="">All types</option>${kinds.map(kind => `<option>${e(kind)}</option>`).join('')}</select></label>
    </div>
    <p id="network-count" role="status"></p>
    <div class="panel table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Connection</th><th>Score</th><th>Profile</th></tr></thead>
      <tbody id="network-rows"></tbody></table></div>`, 'relationships');
  const search = document.querySelector('#network-search');
  const kind = document.querySelector('#network-kind');
  const searchText = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const entries = [...entities].filter(([, person]) => person !== origin)
    .map(([key, person]) => ({ key, person, link: worldRelationships.connection(save, state, origin, person) }))
    .sort((a, b) => b.link.score - a.link.score || a.person.name.localeCompare(b.person.name));
  const show = () => {
    const query = searchText(search.value.trim());
    const matches = entries.filter(({ person }) => (!kind.value || person.kind === kind.value)
      && searchText(person.name + ' ' + (person.code ?? '')).includes(query));
    document.querySelector('#network-count').textContent = matches.length > 40
      ? `Showing the strongest 40 of ${matches.length} matches. Use search or type to narrow the list.`
      : `${matches.length} connection${matches.length === 1 ? '' : 's'}`;
    document.querySelector('#network-rows').innerHTML = matches.slice(0, 40).map(({ key, person, link }) => `<tr>
      <td><a href="#network/${e(key)}">${e(person.name)}</a></td><td>${e(person.kind)}</td>
      <td>${e(link.detail)}${link.source ? ` · <a href="${e(link.source)}">Source</a>` : ''}</td>
      <td>${link.score}/100</td><td>${person.href ? `<a href="${e(person.href)}">Open</a>` : '—'}</td></tr>`).join('');
  };
  search.addEventListener('input', show);
  kind.addEventListener('change', show);
  show();
}

function organizationsScreen(save, id) {
  const state = seasonSim.history(save);
  const organizations = relationships.organizations(save, state);
  const organization = organizations.find(item => item.id === id);
  const contributions = [...save.pastSeasons.flatMap(season => season.financeActions ?? []), ...save.financeActions];
  const raised = key => contributions.filter(action => action.organization === key).reduce((sum, item) => sum + item.cost, 0);
  if (!organization) {
    const list = items => `<div class="panel table-wrap"><table><thead><tr><th>Program</th><th>Affiliation</th><th>Your donations</th></tr></thead>
      <tbody>${items.map(item => `<tr><td><a href="#organizations/${e(item.id)}">${e(item.name)}</a></td>
      <td>${e(item.team ?? 'Independent')}</td><td>${money(raised(item.id))}</td></tr>`).join('') || '<tr><td colspan="3">No projects have opened yet.</td></tr>'}</tbody></table></div>`;
    operationsPage('Organizations', 'Support simulated community programs. Player-led projects open as the franchise progresses.', `
      <section><h2>Player-led projects</h2>${list(organizations.filter(item => item.player))}</section>
      <section><h2>Team community programs</h2>${list(organizations.filter(item => !item.player && !item.audience))}</section>
      <section><h2>Supporter organizations</h2>${list(organizations.filter(item => item.audience && item.team === save.team))}</section>`);
    return;
  }
  const player = state.profiles.get(organization.player);
  const report = teamFinance.report(save, state);
  const canDonate = !state.bracket?.champion && !save.simcast;
  operationsPage(organization.name, organization.mission, `
    ${organization.source ? `<p><a href="${e(organization.source)}">Official foundation website →</a></p>` : ''}
    <div class="franchise-actions"><a href="#organizations">← All organizations</a>
      ${player ? `<a href="#player/${e(player.id)}">View ${e(player.name)} →</a>`
        : `<a href="#team/${e(organization.team)}">View affiliated team →</a>`}</div>
    <dl class="panel bio"><div><dt>Organization relationship</dt><dd>${relationships.score(save, organization.id, 25)} / 100</dd></div>
      ${player ? `<div><dt>${e(player.name)} trust</dt><dd>${relationships.playerScore(save, state, player.id)} / 100</dd></div>` : ''}
      <div><dt>Lifetime donations</dt><dd>${money(raised(id))}</dd></div>
      <div><dt>Available team budget</dt><dd>${money(report.available)}</dd></div>
      <div><dt>Personal wallet</dt><dd><a href="#gm-wallet">${money(teamFinance.gmWallet(save).balance)}</a></dd></div></dl>
    <section class="panel facility-card"><h2>Make a donation</h2>
      <p>Every $25,000 donated this season adds one relationship point, up to eight per organization per season.
        ${player ? 'The same gain applies to the affiliated player.' : ''}
        ${organization.audience && organization.team === save.team ? 'Donations also support ' + e(organization.audience.toLowerCase()) + ' fan outreach for 21 days.' : ''}</p>
      ${canDonate ? `<form class="toolbar" id="donation-form"><label>Donation ($)
        <input name="amount" type="number" min="1000" max="250000" step="1" value="25000" required></label><label>Pay from <select name="funding"><option value="team">Team budget</option><option value="personal">Personal wallet</option></select></label><button>Donate</button></form>`
        : '<p>Donations are closed right now.</p>'}
      <p id="donation-feedback" role="status"></p></section>`);
  document.querySelector('#donation-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = Number(data.get('amount'));
    try {
      const points = relationships.donationImpact(save, organization, amount);
      seasonSim.saveFinanceAction(save, { type: 'facility', facility: 'community', command: 'donate', index: id, value: amount, funding: data.get('funding') });
      render();
      document.querySelector('#donation-feedback').textContent = 'Donation recorded' + (points ? ' · +' + points + ' relationship' : '') + '.';
    } catch (error) { document.querySelector('#donation-feedback').textContent = error.message; }
  });
}

function gmWalletScreen(save) {
  const wallet = teamFinance.gmWallet(save);
  operationsPage('GM wallet', 'Your personal balance is separate from the franchise budget.', `
    <dl class="panel bio"><div><dt>Available personal balance</dt><dd>${money(wallet.balance)}</dd></div>
      <div><dt>Annual GM salary</dt><dd>${money(save.gm?.contract.salary ?? teamFinance.gmSalary)}</dd></div>
      <div><dt>Lifetime salary earned</dt><dd>${money(wallet.earned)}</dd></div>
      <div><dt>Lifetime personal spending</dt><dd>${money(wallet.spent)}</dd></div></dl>
    <p>Salary is paid by your team after each simulated regular-season day. The wallet carries over between seasons.</p>
    <p><a class="primary-link" href="#organizations">Browse organizations and donate →</a> · <a href="#staff-career/${e(save.team)}/gm">Your GM résumé →</a></p>
    <section><h2>Recent personal transactions</h2><div class="panel table-wrap"><table>
      <thead><tr><th>Date</th><th>Transaction</th><th>Amount</th><th>Balance</th></tr></thead><tbody>
      ${wallet.entries.slice(-40).reverse().map(entry => `<tr><td>${simDate(entry.day, entry.year)}</td><td>${e(entry.description)}</td>
        <td>${money(entry.amount)}</td><td>${money(entry.balance)}</td></tr>`).join('')
        || '<tr><td colspan="4">No personal transactions yet. Advance the calendar to earn salary.</td></tr>'}</tbody></table></div></section>`);
}
