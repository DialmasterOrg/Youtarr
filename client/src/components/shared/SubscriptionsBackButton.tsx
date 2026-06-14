import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon } from 'lucide-react';
import { Button } from '../ui';
import { SubscriptionsFilterValue } from '../Subscriptions/components/SubscriptionsFilter';

interface SubscriptionsBackButtonProps {
  tab: SubscriptionsFilterValue;
}

const SubscriptionsBackButton: React.FC<SubscriptionsBackButtonProps> = ({ tab }) => {
  const navigate = useNavigate();

  return (
    <Button
      variant="outlined"
      color="inherit"
      size="small"
      startIcon={<ArrowLeftIcon size={16} />}
      onClick={() => navigate('/subscriptions', { state: { tab } })}
      aria-label="Back to Channels & Playlists"
      style={{ textTransform: 'none' }}
    >
      Channels &amp; Playlists
    </Button>
  );
};

export default SubscriptionsBackButton;
