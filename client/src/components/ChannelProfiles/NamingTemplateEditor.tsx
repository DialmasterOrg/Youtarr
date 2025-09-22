import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Chip,
  Paper,
  Alert,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';

interface TemplateVariable {
  var: string;
  desc: string;
}

interface NamingTemplateEditorProps {
  template: string;
  onChange: (template: string) => void;
  error?: string;
  variables: TemplateVariable[];
}

const NamingTemplateEditor: React.FC<NamingTemplateEditorProps> = ({
  template,
  onChange,
  error,
  variables,
}) => {
  const [previewData, setPreviewData] = useState({
    series: 'My Series',
    season: 1,
    episode: 5,
    title: 'Sample Video Title with Extra Info',
    clean_title: 'Sample Video Title',
    year: '2024',
    month: '01',
    day: '15',
    channel: 'Channel Name',
    id: 'abc123def456',
  });

  const presetTemplates = [
    {
      name: 'Standard TV Show',
      template: '{series} - s{season:02d}e{episode:03d} - {clean_title}',
      description: 'Standard format: Series - s01e001 - Title',
    },
    {
      name: 'Simple Format',
      template: 'S{season:02d}E{episode:03d} - {title}',
      description: 'Simple format: S01E001 - Title',
    },
    {
      name: 'Date-Based',
      template: '{series} - {year}x{month:02d}{day:02d} - {title}',
      description: 'Date format: Series - 2024x0115 - Title',
    },
    {
      name: 'Channel Prefix',
      template: '{channel} - {series} - s{season:02d}e{episode:03d} - {clean_title}',
      description: 'With channel: Channel - Series - s01e001 - Title',
    },
    {
      name: 'Minimal',
      template: '{episode:03d} - {clean_title}',
      description: 'Just episode: 001 - Title',
    },
  ];

  const generatePreview = (templateStr: string): string => {
    let result = templateStr;

    // Helper function to pad numbers
    const pad = (num: number, size: number) => {
      let s = num.toString();
      while (s.length < size) s = '0' + s;
      return s;
    };

    // Replace template variables
    const replacements: Record<string, string> = {
      '{series}': previewData.series,
      '{season}': previewData.season.toString(),
      '{season:02d}': pad(previewData.season, 2),
      '{season:03d}': pad(previewData.season, 3),
      '{episode}': previewData.episode.toString(),
      '{episode:02d}': pad(previewData.episode, 2),
      '{episode:03d}': pad(previewData.episode, 3),
      '{title}': previewData.title,
      '{clean_title}': previewData.clean_title,
      '{year}': previewData.year,
      '{month}': previewData.month,
      '{month:02d}': pad(parseInt(previewData.month), 2),
      '{day}': previewData.day,
      '{day:02d}': pad(parseInt(previewData.day), 2),
      '{channel}': previewData.channel,
      '{id}': previewData.id,
    };

    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    // Clean up invalid filename characters for preview
    result = result.replace(/[<>:"/\\|?*]/g, '');
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-input') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newTemplate = template.substring(0, start) + variable + template.substring(end);
      onChange(newTemplate);

      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    } else {
      onChange(template + variable);
    }
  };

  const applyPreset = (presetTemplate: string) => {
    onChange(presetTemplate);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const validateTemplate = (templateStr: string): string | null => {
    if (!templateStr.trim()) {
      return 'Template cannot be empty';
    }

    // Check for required variables (at least one should be present)
    const hasEpisodeInfo = templateStr.includes('{episode') || templateStr.includes('{season');
    const hasTitleInfo = templateStr.includes('{title') || templateStr.includes('{clean_title');

    if (!hasEpisodeInfo && !hasTitleInfo) {
      return 'Template should include at least episode or title information';
    }

    // Check for invalid filename characters in static parts
    const invalidChars = /[<>:"/\\|?*]/;
    const staticParts = templateStr.replace(/\{[^}]+\}/g, '');
    if (invalidChars.test(staticParts)) {
      return 'Template contains invalid filename characters outside of variables';
    }

    return null;
  };

  const templateError = error || validateTemplate(template);
  const preview = templateError ? 'Invalid template' : generatePreview(template);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Template Input */}
      <TextField
        id="template-input"
        label="Naming Template"
        value={template}
        onChange={(e) => onChange(e.target.value)}
        error={!!templateError}
        helperText={templateError || 'Use variables to create dynamic filenames'}
        multiline
        rows={2}
        fullWidth
      />

      {/* Preview */}
      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Preview
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            p: 1,
            bgcolor: 'white',
            border: 1,
            borderColor: 'grey.300',
            borderRadius: 1,
            color: templateError ? 'error.main' : 'text.primary',
          }}
        >
          {preview}
        </Typography>
      </Paper>

      {/* Variable Buttons */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Insert Variables
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {variables.map((variable) => (
            <Chip
              key={variable.var}
              label={variable.var}
              onClick={() => insertVariable(variable.var)}
              clickable
              size="small"
              variant="outlined"
              icon={<AddIcon />}
            />
          ))}
        </Box>
      </Box>

      <Divider />

      {/* Preset Templates */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Preset Templates
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {presetTemplates.map((preset, index) => (
            <Paper key={index} sx={{ p: 2, border: 1, borderColor: 'grey.200' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">
                  {preset.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() => copyToClipboard(preset.template)}
                    startIcon={<CopyIcon />}
                  >
                    Copy
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => applyPreset(preset.template)}
                  >
                    Use
                  </Button>
                </Box>
              </Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {preset.description}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  display: 'block',
                  p: 1,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                }}
              >
                {preset.template}
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                Preview: {generatePreview(preset.template)}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Box>

      {/* Sample Data Editor */}
      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Preview Data (Edit to test different scenarios)
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
          <TextField
            label="Series"
            value={previewData.series}
            onChange={(e) => setPreviewData({ ...previewData, series: e.target.value })}
            size="small"
          />
          <TextField
            label="Season"
            type="number"
            value={previewData.season}
            onChange={(e) => setPreviewData({ ...previewData, season: parseInt(e.target.value) || 1 })}
            size="small"
          />
          <TextField
            label="Episode"
            type="number"
            value={previewData.episode}
            onChange={(e) => setPreviewData({ ...previewData, episode: parseInt(e.target.value) || 1 })}
            size="small"
          />
          <TextField
            label="Title"
            value={previewData.title}
            onChange={(e) => setPreviewData({ ...previewData, title: e.target.value })}
            size="small"
          />
          <TextField
            label="Clean Title"
            value={previewData.clean_title}
            onChange={(e) => setPreviewData({ ...previewData, clean_title: e.target.value })}
            size="small"
          />
          <TextField
            label="Channel"
            value={previewData.channel}
            onChange={(e) => setPreviewData({ ...previewData, channel: e.target.value })}
            size="small"
          />
        </Box>
      </Paper>

      {/* Help */}
      <Alert severity="info">
        <Typography variant="body2">
          <strong>Tips:</strong>
        </Typography>
        <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 16 }}>
          <li>Use <code>{'{clean_title}'}</code> instead of <code>{'{title}'}</code> to remove filter-matched text</li>
          <li>Add padding to numbers: <code>{'{episode:03d}'}</code> becomes "001", "002", etc.</li>
          <li>The preview updates in real-time as you type</li>
          <li>Invalid filename characters will be automatically removed</li>
        </ul>
      </Alert>
    </Box>
  );
};

export default NamingTemplateEditor;