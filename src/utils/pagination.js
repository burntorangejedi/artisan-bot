// Shared pagination helpers for commands that produce multi-page text outputs
function paginateTable(header, lines, pageSize) {
  const pages = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    const pageLines = lines.slice(i, i + pageSize);
    const body = [header, ...pageLines].join('\n');
    pages.push('```' + body + '```');
  }
  return pages.length ? pages : ['```' + header + '\n' + 'No results' + '```'];
}

// componentsFor(prefix, disabledPrev, disabledNext)
// returns a Discord ActionRow with two buttons using custom_ids prefixed by `prefix`.
function componentsFor(prefix, disabledPrev, disabledNext) {
  return [
    {
      type: 1,
      components: [
        { type: 2, style: 1, label: 'Previous', custom_id: `${prefix}_prev`, disabled: !!disabledPrev },
        { type: 2, style: 1, label: 'Next', custom_id: `${prefix}_next`, disabled: !!disabledNext }
      ]
    }
  ];
}

module.exports = { paginateTable, componentsFor };
