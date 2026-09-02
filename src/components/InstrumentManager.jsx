import { useMemo, useState } from 'react';
import { Button, Card, ConfirmDialog, DataTable, EmptyState, FormField, Modal, StatusBadge } from './Common';
import { filterByText, inputClass, statusOptions } from '../utils/display';

const initialForm = (fields) => Object.fromEntries(fields.map(field => [field.name, field.defaultValue ?? '']));

export const InstrumentManager = ({ title, description, records, fields, columns, onCreate, onUpdate, onDelete, searchFields, filters = [], detailTitle, canCreate = true, canEdit = true, canDelete = true, editLabel = 'Editar', submitLabel = 'Salvar', emptyTitle = 'Sem registros', emptyDescription = 'Ajuste os filtros ou crie um novo registro para continuar.' }) => {
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState(Object.fromEntries(filters.map(filter => [filter.name, 'todos'])));
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState('');

  const filteredRecords = useMemo(() => {
    let result = filterByText(records, search, searchFields);
    filters.forEach(filter => {
      const value = filterValues[filter.name];
      if (value !== 'todos') {
        result = result.filter(record => String(filter.getValue(record)) === String(value));
      }
    });
    return result;
  }, [records, search, searchFields, filters, filterValues]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditing(null);
    setForm(initialForm(fields));
  };

  const openEdit = (record) => {
    if (!canEdit) return;
    setEditing(record);
    setForm(Object.fromEntries(fields.map(field => [field.name, record[field.name] ?? field.defaultValue ?? ''])));
  };

  const closeForm = () => {
    setEditing(null);
    setForm(null);
  };

  const handleChange = (field, value) => {
    const parsedValue = field.type === 'number' || field.kind === 'select-number' ? Number(value) : value;
    setForm(prev => ({ ...prev, [field.name]: parsedValue }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (editing) {
      onUpdate(editing.id, form);
      setMessage('Registro atualizado com sucesso.');
    } else {
      onCreate(form);
      setMessage('Registro criado com sucesso.');
    }
    closeForm();
  };

  const confirmDelete = () => {
    onDelete(deleting.id);
    setDeleting(null);
    setMessage('Registro excluído com sucesso.');
  };

  const actionColumn = {
    key: 'acoes',
    header: 'Ações',
    render: (row) => (
      <div className="flex gap-2" onClick={event => event.stopPropagation()}>
        {canEdit && <Button variant="outline" size="sm" onClick={() => openEdit(row)}>{editLabel}</Button>}
        {canDelete && <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>Excluir</Button>}
      </div>
    ),
  };
  const tableColumns = canEdit || canDelete ? [...columns, actionColumn] : columns;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
        </div>
        {canCreate && <Button onClick={openCreate}>Novo registro</Button>}
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <FormField label="Busca">
            <input className={inputClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar registros" />
          </FormField>
          {filters.map(filter => (
            <FormField key={filter.name} label={filter.label}>
              <select className={inputClass} value={filterValues[filter.name]} onChange={event => setFilterValues(prev => ({ ...prev, [filter.name]: event.target.value }))}>
                <option value="todos">Todos</option>
                {filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
          ))}
        </div>
      </Card>

      {filteredRecords.length ? (
        <DataTable columns={tableColumns} rows={filteredRecords} onRowClick={setViewing} />
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}

      {form && (
        <Modal title={editing ? 'Editar registro' : 'Novo registro'} onClose={closeForm}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {fields.filter(field => !field.hidden).map(field => (
                <FormField key={field.name} label={field.label}>
                  {field.type === 'textarea' ? (
                    <textarea className={inputClass} rows="3" value={form[field.name]} onChange={event => handleChange(field, event.target.value)} required={field.required} />
                  ) : field.options ? (
                    <select className={inputClass} value={form[field.name]} onChange={event => handleChange(field, event.target.value)} required={field.required}>
                      {field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input className={inputClass} type={field.type || 'text'} value={form[field.name]} onChange={event => handleChange(field, event.target.value)} required={field.required} />
                  )}
                </FormField>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={closeForm}>Cancelar</Button>
              <Button type="submit">{submitLabel}</Button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={detailTitle || 'Detalhes do registro'} onClose={() => setViewing(null)}>
          <div className="grid gap-4 md:grid-cols-2">
            {columns.filter(column => column.key !== 'acoes').map(column => (
              <div key={column.key} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{column.header}</p>
                <div className="mt-1 text-sm font-medium text-slate-800">{column.render ? column.render(viewing) : viewing[column.key]}</div>
              </div>
            ))}
            {viewing.status && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-1"><StatusBadge status={viewing.status} /></div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {deleting && <ConfirmDialog title="Excluir registro" message="Esta ação remove o registro da sessão atual. Deseja continuar?" onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />}
    </div>
  );
};

export const statusField = { name: 'status', label: 'Status', required: true, options: statusOptions };