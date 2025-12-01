import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function WebSearch() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/events');
  }, [navigate]);
  
  return null;
}
