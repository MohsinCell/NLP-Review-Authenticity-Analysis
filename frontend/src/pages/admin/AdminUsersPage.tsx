import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, ChevronLeft, ChevronRight, Shield, ShieldCheck, UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import { useApiError } from '../../hooks/useApiError';
import type { AdminUserListResponse, PagedResponse } from '../../types';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
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

export default function AdminUsersPage() {
  const [data, setData] = useState<PagedResponse<AdminUserListResponse> | null>(null);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { getErrorMessage } = useApiError();
  const pageSize = 20;

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const response = await adminApi.getUsers(page, pageSize);
        setData(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, [page, getErrorMessage]);

  const filteredContent = data?.content.filter((user) =>
    search
      ? (user.fullName?.toLowerCase().includes(search.toLowerCase()) ||
         user.email?.toLowerCase().includes(search.toLowerCase()) ||
         user.role?.toLowerCase().includes(search.toLowerCase()))
      : true
  ) ?? [];

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
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-sm text-neutral-500">
              {data ? (
                <><span className="text-white font-semibold">{data.totalElements}</span> registered users</>
              ) : (
                'Loading...'
              )}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </motion.div>

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
        ) : filteredContent.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="No users found"
              description={search ? 'No users match your search.' : 'No users registered yet.'}
            />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Total Users', value: data?.totalElements || 0, icon: Users },
                { label: 'Admins', value: filteredContent.filter(u => u.role === 'ADMIN').length, icon: ShieldCheck },
                { label: 'Active', value: filteredContent.filter(u => u.enabled).length, icon: UserCircle },
                { label: 'This Page', value: filteredContent.length, icon: Shield },
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

            <div className="space-y-3 md:hidden">
              {filteredContent.map((user) => (
                <Card key={user.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/[0.05] flex items-center justify-center border border-white/10 shrink-0">
                      <span className="text-sm font-semibold text-white">
                        {user.fullName?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white truncate">{user.fullName}</span>
                        <Badge variant={user.role === 'ADMIN' ? 'info' : 'default'}>
                          {user.role === 'ADMIN' ? (
                            <><ShieldCheck className="mr-1 h-3 w-3" />Admin</>
                          ) : (
                            <><Shield className="mr-1 h-3 w-3" />User</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">{user.email}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant={user.enabled ? 'success' : 'danger'}>
                          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${user.enabled ? 'bg-green-400' : 'bg-red-400'}`} />
                          {user.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <span className="text-xs text-neutral-500">{user.totalAnalyses} analyses</span>
                        <span className="text-xs text-neutral-500">{formatDate(user.createdAt)}</span>
                      </div>
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
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Role</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 hidden lg:table-cell">Analyses</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 hidden lg:table-cell">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredContent.map((user) => (
                      <tr
                        key={user.id}
                        className="group"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-white/[0.05] flex items-center justify-center border border-white/10 shrink-0">
                              <span className="text-sm font-semibold text-white">
                                {user.fullName?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-white block truncate">
                              {user.fullName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-400">
                          <span className="truncate block max-w-[200px]">{user.email}</span>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={user.role === 'ADMIN' ? 'info' : 'default'}>
                            {user.role === 'ADMIN' ? (
                              <><ShieldCheck className="mr-1 h-3 w-3" />Admin</>
                            ) : (
                              <><Shield className="mr-1 h-3 w-3" />User</>
                            )}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={user.enabled ? 'success' : 'danger'}>
                            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${user.enabled ? 'bg-green-400' : 'bg-red-400'}`} />
                            {user.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 hidden lg:table-cell">
                          <span className="text-sm font-semibold text-white">
                            {user.totalAnalyses}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-400 whitespace-nowrap hidden lg:table-cell">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {data && data.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-neutral-500">
                  Page <span className="text-white font-medium">{data.page + 1}</span> of{' '}
                  <span className="text-white font-medium">{data.totalPages}</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={data.page === 0}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={data.last}
                    aria-label="Next page"
                  >
                    <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
