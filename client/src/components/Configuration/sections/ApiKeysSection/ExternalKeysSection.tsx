import React, { useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '../../../ui';
import { Filter as FilterIcon, Plus as AddIcon } from 'lucide-react';
import ExternalKeyCard from './ExternalKeyCard';
import { ApiKey } from './useApiKeys';

interface ExternalKeysSectionProps {
  keys: ApiKey[];
  onCreate: () => void;
  onEdit: (key: ApiKey) => void;
  onRegenerate: (key: ApiKey) => void;
  onRevoke: (id: number, name: string) => void;
}

export default function ExternalKeysSection({ keys, onCreate, onEdit, onRegenerate, onRevoke }: ExternalKeysSectionProps) {
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const query = search.trim().toLocaleLowerCase();
  const visibleKeys = keys
    .filter((key) => !activeOnly || (key.is_active && !key.revoked_at))
    .filter((key) => !query || key.name.toLocaleLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return (
    <>
      <Box className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography variant="subtitle1">External access keys</Typography>
          <Typography variant="body2" color="secondary" className="mt-1 max-w-2xl">
            For integrations that use <code>/external-api/v1</code>. Every external key can view its approved
            channels. Add only the request permissions the integration needs.
          </Typography>
        </div>
        <Button variant="contained" startIcon={<AddIcon size={16} />} onClick={onCreate} size="small">
          Create external key
        </Button>
      </Box>

      {keys.length > 0 && (
        <Box className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-stretch">
          <TextField
            label="Search external access keys"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            fullWidth
            size="small"
          />
          <Button
            variant={activeOnly ? 'contained' : 'outlined'}
            startIcon={<FilterIcon size={16} />}
            onClick={() => setActiveOnly((current) => !current)}
            aria-pressed={activeOnly}
            size="small"
            className="shrink-0 self-start sm:self-stretch"
            style={{ height: 'auto' }}
          >
            Active only
          </Button>
        </Box>
      )}

      {visibleKeys.length === 0 ? (
        <Paper className="border border-dashed border-border p-6 text-center shadow-none">
          <Typography color="secondary">
            {keys.length === 0
              ? 'No external access keys yet.'
              : 'No external access keys match the current search and filter.'}
          </Typography>
        </Paper>
      ) : (
        <div className="grid gap-3" aria-label="External API key cards">
          {visibleKeys.map((key) => (
            <ExternalKeyCard key={key.id} apiKey={key} onEdit={onEdit} onRegenerate={onRegenerate} onRevoke={onRevoke} />
          ))}
        </div>
      )}
    </>
  );
}
