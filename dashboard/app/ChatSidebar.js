"use client";

import { useState } from "react";
import { groupByDate } from "./lib/conversation-store";

const GROUP_LABELS = {
  today: "Hari ini",
  yesterday: "Kemarin",
  last7: "7 hari terakhir",
  last30: "30 hari terakhir",
  older: "Lebih lama",
};

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
  desktopHidden = false,
  onCollapse,
}) {
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const filtered = search.trim()
    ? conversations.filter((c) => {
        const q = search.trim().toLowerCase();
        if (c.title.toLowerCase().includes(q)) return true;
        return c.messages.some((m) =>
          (m.content || "").toLowerCase().includes(q)
        );
      })
    : conversations;

  const grouped = groupByDate(filtered);

  function handleDelete(id, e) {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((curr) => (curr === id ? null : curr)), 3000);
    }
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`helix-sidebar-surface fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r backdrop-blur-xl transition-all duration-300 md:static ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          desktopHidden
            ? "md:w-0 md:-translate-x-full md:overflow-hidden md:border-r-0"
            : "md:w-72 md:translate-x-0"
        }`}
      >
        <div className="helix-section-divider flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Riwayat Chat
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onCollapse}
              className="icon-btn hidden rounded-md p-1 text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 md:block"
              aria-label="Sembunyikan sidebar"
              title="Sembunyikan sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
                <path d="M14 9l-2 3 2 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="icon-btn rounded-md p-1 text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 md:hidden"
              aria-label="Tutup sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="helix-section-divider border-b p-3">
          <button
            onClick={() => {
              onNew();
              onClose?.();
            }}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Chat Baru
          </button>
        </div>

        <div className="helix-section-divider border-b p-3">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari riwayat..."
              className="helix-input-surface w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {conversations.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-slate-500">
                Belum ada percakapan.
                <br />
                Mulai chat baru!
              </p>
            </div>
          )}

          {conversations.length > 0 && filtered.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-slate-500">
                Tidak ada hasil untuk &quot;{search}&quot;
              </p>
            </div>
          )}

          {Object.entries(grouped).map(([key, convs]) => {
            if (convs.length === 0) return null;
            return (
              <div key={key} className="mb-4">
                <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {GROUP_LABELS[key]}
                </div>
                <ul className="space-y-0.5">
                  {convs.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      active={conv.id === activeId}
                      confirmDelete={confirmDeleteId === conv.id}
                      onSelect={() => {
                        onSelect(conv.id);
                        onClose?.();
                      }}
                      onDelete={(e) => handleDelete(conv.id, e)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="helix-section-divider border-t px-3 py-2">
          <p className="text-[10px] text-slate-500">
            {conversations.length} percakapan tersimpan di browser ini
          </p>
        </div>
      </aside>
    </>
  );
}

function ConversationItem({ conv, active, confirmDelete, onSelect, onDelete }) {
  return (
    <li>
      <button
        onClick={onSelect}
        data-active={active}
        className={`menu-item group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
          active ? "helix-conv-active" : "helix-conv-hover"
        }`}
      >
        <span className="flex-1 truncate" title={conv.title}>
          {conv.title}
        </span>
        <span
          onClick={onDelete}
          className={`shrink-0 rounded p-1 ${
            confirmDelete
              ? "bg-red-500/20 text-red-300"
              : "fade-on-hover opacity-0 text-slate-500 hover:bg-slate-700 hover:text-red-300 group-hover:opacity-100"
          }`}
          title={confirmDelete ? "Klik lagi untuk konfirmasi" : "Hapus"}
          role="button"
          tabIndex={0}
          aria-label={confirmDelete ? "Konfirmasi hapus" : "Hapus percakapan"}
        >
          {confirmDelete ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>
    </li>
  );
}
