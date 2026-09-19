import { BookOpen, ExternalLink, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import './ConnectomeAtlas.css';

interface AtlasCell {
  bodyId: string;
  type: string;
  instance: string | null;
  class: string | null;
  superclass: string | null;
  somaSide: string | null;
  status: string;
  statusLabel: string | null;
  flywireType: string | null;
  hemibrainType: string | null;
}

interface AtlasGroup {
  id: string;
  label: string;
  annotationField: 'class' | 'superclass';
  annotationValue: string;
  totalMatches: number;
  eligibleTracedTypedMatches: number;
  sampledCount: number;
  cells: AtlasCell[];
}

interface Atlas {
  schemaVersion: number;
  dataset: string;
  version: string;
  retrievedAt: string;
  sampledRows: number;
  groups: AtlasGroup[];
  selection: { rule: string; transformations: string };
  source: {
    annotationRows: number;
    bytes: number;
    sha256: string;
    attribution: string;
    license: string;
  };
}

const atlasPath = '/data/malecns-v1.0-atlas.json';
const counts = new Intl.NumberFormat('en-US');

export function ConnectomeAtlas() {
  const headingId = useId();
  const searchId = useId();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [groupId, setGroupId] = useState('kenyon');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError(false);
    fetch(atlasPath, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Atlas unavailable');
        const data = (await response.json()) as Atlas;
        if (
          data.schemaVersion !== 1 ||
          data.dataset !== 'MaleCNS' ||
          data.version !== 'v1.0' ||
          !Array.isArray(data.groups) ||
          !data.groups.length ||
          !data.groups.every((group) => Array.isArray(group.cells))
        ) {
          throw new Error('Atlas format not supported');
        }
        if (active) setAtlas(data);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  const group = atlas?.groups.find((item) => item.id === groupId) ?? atlas?.groups[0];
  const search = query.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!atlas || !group) return [];
    // A search covers the entire bundled sample, even when another group is selected.
    return (search ? atlas.groups : [group]).flatMap((item) =>
      item.cells
        .filter(
          (cell) =>
            !search ||
            [cell.bodyId, cell.type, cell.instance, cell.flywireType, cell.hemibrainType].some(
              (value) => value?.toLowerCase().includes(search),
            ),
        )
        .map((cell) => ({ cell, group: item })),
    );
  }, [atlas, group, search]);

  return (
    <section className="connectome-atlas" aria-labelledby={headingId}>
      <div className="atlas-heading">
        <div>
          <span className="atlas-kicker">
            <BookOpen size={13} /> OFFICIAL ANATOMY
          </span>
          <h3 id={headingId}>MaleCNS reference atlas</h3>
        </div>
        <span className="atlas-version">v1.0</span>
      </div>
      <p className="atlas-intro">
        Actual annotations from the Google Research and Janelia collaboration. These reference cells
        do not control the fly. Their firing activity and connections are not included here.
      </p>

      {error ? (
        <div className="atlas-load-state" role="alert">
          <p>The annotation sample could not be loaded.</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : !atlas || !group ? (
        <p className="atlas-load-state" role="status">
          Loading the bundled MaleCNS annotations…
        </p>
      ) : (
        <>
          <div className="atlas-summary">
            <strong>{atlas.sampledRows} sampled cells</strong>
            <span>{atlas.groups.length} annotation groups · anatomy only</span>
          </div>
          <div className="atlas-group-list" role="group" aria-label="Neuron annotation groups">
            {atlas.groups.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === group.id}
                onClick={() => {
                  setGroupId(item.id);
                  setQuery('');
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="atlas-search" htmlFor={searchId}>
            <Search size={15} aria-hidden="true" />
            <span className="atlas-visually-hidden">
              Search sampled cells by type, name or body ID
            </span>
            <input
              id={searchId}
              type="search"
              placeholder="Search sampled types or body IDs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="atlas-group-description" aria-live="polite">
            {search ? (
              <p>
                {rows.length} {rows.length === 1 ? 'match' : 'matches'} across the{' '}
                {atlas.sampledRows}-cell sample. This search does not query the full connectome.
              </p>
            ) : (
              <p>
                <strong>{group.label}</strong>: {group.sampledCount} shown from{' '}
                {counts.format(group.eligibleTracedTypedMatches)} traced, typed entries. The source
                has {counts.format(group.totalMatches)} rows labeled{' '}
                <code>
                  {group.annotationField}={group.annotationValue}
                </code>
                .
              </p>
            )}
          </div>
          <div
            className="atlas-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="MaleCNS annotation table"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Type / instance</th>
                  <th scope="col">Body ID</th>
                  <th scope="col">Side</th>
                  <th scope="col">Annotation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ cell, group: cellGroup }) => (
                  <tr key={`${cellGroup.id}:${cell.bodyId}`}>
                    <td>
                      <strong>{cell.type}</strong>
                      <span>{cell.instance ?? 'No instance label'}</span>
                    </td>
                    <td>
                      <code>{cell.bodyId}</code>
                    </td>
                    <td>
                      {cell.somaSide === 'L'
                        ? 'Left'
                        : cell.somaSide === 'R'
                          ? 'Right'
                          : (cell.somaSide ?? 'Unspecified')}
                    </td>
                    <td>
                      <span>{cellGroup.annotationValue}</span>
                      <small>{cell.status}</small>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={4}>No matching cells in this sample.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="atlas-sample-note">
            First 12 traced, typed body IDs in each selected group. This teaching sample is not a
            complete or representative circuit. “DAN” is a source class label, not a live reward
            signal.
          </p>
          <details className="atlas-provenance">
            <summary>Source, selection and attribution</summary>
            <p>{atlas.source.attribution}</p>
            <p>{atlas.selection.rule}</p>
            <p>{atlas.selection.transformations}</p>
            <p>
              Source file: {counts.format(atlas.source.annotationRows)} annotation rows, including
              non-neuronal and unassigned entries; {counts.format(atlas.source.bytes)} bytes.
              Retrieved {atlas.retrievedAt}.
            </p>
            <p className="atlas-checksum">
              Source SHA-256: <code>{atlas.source.sha256}</code>
            </p>
            <div className="atlas-links">
              <a href="https://male-cns.janelia.org/download/" target="_blank" rel="noreferrer">
                Official dataset <ExternalLink size={12} />
              </a>
              <a href="https://neuprint.janelia.org/" target="_blank" rel="noreferrer">
                Explore in neuPrint <ExternalLink size={12} />
              </a>
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                {atlas.source.license} <ExternalLink size={12} />
              </a>
              <a href={atlasPath} download="malecns-v1.0-atlas.json">
                Download this sample
              </a>
            </div>
            <p>
              In neuPrint, choose <code>male-cns:v1.0</code> and search a body ID above. An account
              may be required.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
