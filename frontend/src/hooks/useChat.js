import { useState, useEffect, useCallback } from 'react';
import { socket } from '../services/socket';

export function useChat(boardId, user) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.connect();
    socket.emit('joinBoard', boardId);

    socket.on('chat:message', msg => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off('chat:message');
      socket.disconnect();
    };
  }, [boardId]);

  const sendMessage = useCallback(text => {
    const payload = { boardId, user, text };
    socket.emit('chat:message', payload);
    setMessages(prev => [...prev, { user, text }]);
  }, [boardId, user]);

  return { messages, sendMessage };
}
