import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Search, Eye, Calendar, User, MessageSquare, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import { useApiError } from '../../hooks/useApiError';
import type { ContactMessageResponse } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { formatDate } from '../../lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35 }
  }
};

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ContactMessageResponse | null>(null);
  const { getErrorMessage } = useApiError();

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const response = await adminApi.getContactMessages();
        setMessages(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();
  }, [getErrorMessage]);

  const filtered = messages.filter((msg) =>
    search
      ? msg.firstName.toLowerCase().includes(search.toLowerCase()) ||
        msg.lastName.toLowerCase().includes(search.toLowerCase()) ||
        msg.email.toLowerCase().includes(search.toLowerCase()) ||
        msg.subject.toLowerCase().includes(search.toLowerCase())
      : true
  );

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-6 py-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >

      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08]">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Contact Messages</h1>
            <p className="text-sm text-neutral-500">
              {isLoading ? 'Loading...' : (
                <><span className="text-white font-semibold">{messages.length}</span> message{messages.length !== 1 ? 's' : ''} received</>
              )}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </motion.div>

      {!isLoading && messages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total Messages', value: messages.length, icon: Inbox },
            { label: 'From Users', value: messages.filter(m => m.userId).length, icon: User },
            { label: 'Anonymous', value: messages.filter(m => !m.userId).length, icon: MessageSquare },
            { label: 'This Week', value: messages.filter(m => {
              const date = new Date(m.createdAt);
              const week = new Date();
              week.setDate(week.getDate() - 7);
              return date >= week;
            }).length, icon: Calendar },
          ].map((stat) => (
            <motion.div key={stat.label} variants={itemVariants}>
              <Card className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-neutral-500 uppercase tracking-wider truncate">{stat.label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.05] shrink-0">
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-400" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-20"
          >
            <Spinner size="lg" />
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState
              icon={<Mail className="h-12 w-12" />}
              title="No messages found"
              description={search ? 'No messages match your search.' : 'No contact messages have been submitted yet.'}
            />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >

            <div className="space-y-3 md:hidden">
              {filtered.map((msg) => (
                <Card key={msg.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/[0.05] flex items-center justify-center border border-white/10 shrink-0">
                      <span className="text-sm font-semibold text-white">
                        {msg.firstName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white truncate">{msg.firstName} {msg.lastName}</span>
                        <Button variant="ghost" size="sm" onClick={() => setSelected(msg)}>
                          <Eye className="h-4 w-4" /> View
                        </Button>
                      </div>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">{msg.email}</p>
                      <p className="text-sm text-neutral-300 truncate mt-1">{msg.subject}</p>
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-1">{msg.message}</p>
                      <p className="text-xs text-neutral-500 mt-2">{formatDate(msg.createdAt)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="overflow-hidden p-0 hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Name</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Email</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Subject</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 hidden lg:table-cell">Preview</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Date</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((msg) => (
                      <tr
                        key={msg.id}
                        className="group"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-white/[0.05] flex items-center justify-center border border-white/10 shrink-0">
                              <span className="text-sm font-semibold text-white">
                                {msg.firstName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-white block truncate">
                              {msg.firstName} {msg.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-400">
                          <span className="truncate block max-w-[200px]">{msg.email}</span>
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-300">
                          <span className="truncate block max-w-[180px]">{msg.subject}</span>
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-500 hidden lg:table-cell">
                          <span className="truncate block max-w-[200px]">{msg.message}</span>
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-400 whitespace-nowrap">
                          {formatDate(msg.createdAt)}
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(msg)}
                          >
                            <Eye className="h-4 w-4" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Message Details">
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/[0.03] p-4 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-neutral-500" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">From</p>
                </div>
                <p className="text-sm font-medium text-white">{selected.firstName} {selected.lastName}</p>
                <p className="text-xs text-neutral-400 mt-0.5 truncate">{selected.email}</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-4 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-neutral-500" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Date Received</p>
                </div>
                <p className="text-sm text-white">{formatDate(selected.createdAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Subject</p>
              <p className="text-sm font-medium text-white">{selected.subject}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Message</p>
              <div className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.06]">
                <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
              </div>
            </div>

            {selected.userId && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Registered User ID</p>
                <code className="text-sm text-neutral-400 font-mono bg-white/[0.05] px-3 py-1.5 rounded-lg">
                  {selected.userId}
                </code>
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
