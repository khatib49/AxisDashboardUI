// RecipeEditorModal
// =================
// Drop-in modal usable from any "Items" admin page (Admin/Items,
// AdminFnB/Items). Pass the item being edited; the modal loads its
// current recipe, lets the chef add / change / remove ingredient lines,
// and saves the full-replacement payload to /api/recipes.

import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Table,
  Button,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
  message,
  Input,
  Empty,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  RecipeLineDto,
  getRecipeForItem,
  upsertRecipe,
} from "../../services/recipeService";
import {
  IngredientDto,
  getIngredients,
} from "../../services/ingredientService";

const { Text } = Typography;

type DraftLine = {
  key: string;
  ingredientId: number | null;
  quantity: number;
  // Ingredient's canonical unit (e.g. "kg") — shown as context only.
  unit: string;
  // Recipe-line unit picked by the chef. May differ from `unit`; backend
  // converts before touching stock. Never null in the draft — we default
  // to the ingredient's unit when the row is created.
  recipeUnit: string;
  notes: string;
};

// The units we support in the recipe dropdown. Backend UnitConverter
// handles g↔kg and ml↔l. Same-unit picks are always a no-op.
const RECIPE_UNITS = ["g", "kg", "ml", "l", "pcs"] as const;

type Props = {
  open: boolean;
  itemId: number | null;
  itemName?: string;
  onClose: () => void;
  onSaved?: () => void;
};

let nextKey = 1;
const makeKey = () => `r-${nextKey++}`;

export default function RecipeEditorModal({ open, itemId, itemName, onClose, onSaved }: Props) {
  const [ingredients, setIngredients] = useState<IngredientDto[]>([]);
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load active ingredients + current recipe when the modal opens.
  useEffect(() => {
    if (!open || !itemId) return;
    let mounted = true;
    setLoading(true);
    Promise.all([getIngredients(), getRecipeForItem(itemId)])
      .then(([ings, recipe]) => {
        if (!mounted) return;
        setIngredients(ings);
        setDraft(
          (recipe as RecipeLineDto[]).map((l) => ({
            key: makeKey(),
            ingredientId: l.ingredientId,
            quantity: l.quantity,
            unit: l.unit,
            // Fall back to the ingredient's unit for legacy rows without
            // a recipeUnit (pre-Bug#9 migration).
            recipeUnit: l.recipeUnit ?? l.unit,
            notes: l.notes ?? "",
          }))
        );
      })
      .catch(() => mounted && message.error("Failed to load recipe"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [open, itemId]);

  const ingredientById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients]
  );

  function addRow() {
    setDraft((d) => [
      ...d,
      { key: makeKey(), ingredientId: null, quantity: 0, unit: "", recipeUnit: "", notes: "" },
    ]);
  }

  function removeRow(key: string) {
    setDraft((d) => d.filter((r) => r.key !== key));
  }

  function patchRow(key: string, patch: Partial<DraftLine>) {
    setDraft((d) =>
      d.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        // When the ingredient changes, sync BOTH the display unit
        // (context) and the recipe unit (default = same as ingredient).
        if (patch.ingredientId != null) {
          const ing = ingredientById.get(patch.ingredientId);
          const ingUnit = ing?.unit ?? "";
          next.unit = ingUnit;
          // Only reset recipeUnit if it was empty or was matching the
          // previous ingredient's unit — respect a chef-picked override.
          if (!next.recipeUnit || next.recipeUnit === r.unit) {
            next.recipeUnit = ingUnit;
          }
        }
        return next;
      })
    );
  }

  async function save() {
    if (!itemId) return;
    // Validation: no duplicate ingredients, all have qty > 0
    const seen = new Set<number>();
    for (const r of draft) {
      if (r.ingredientId == null) { message.error("Pick an ingredient on every row"); return; }
      if (seen.has(r.ingredientId)) { message.error("Same ingredient appears twice"); return; }
      seen.add(r.ingredientId);
      if (!(r.quantity > 0)) { message.error("Every quantity must be > 0"); return; }
    }
    setSaving(true);
    try {
      await upsertRecipe({
        itemId,
        lines: draft.map((r) => ({
          ingredientId: r.ingredientId as number,
          quantity: r.quantity,
          // Send the recipe-line unit so the backend can convert to the
          // ingredient's canonical unit before touching stock. If it matches
          // the ingredient's unit exactly, the converter is a no-op.
          unit: r.recipeUnit || null,
          notes: r.notes || null,
        })),
      });
      message.success(`Recipe saved (${draft.length} ingredient${draft.length === 1 ? "" : "s"})`);
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      message.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnsType<DraftLine> = [
    {
      title: "Ingredient",
      key: "ingredientId",
      render: (_, r) => (
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Pick ingredient"
          value={r.ingredientId ?? undefined}
          onChange={(v) => patchRow(r.key, { ingredientId: v as number })}
          style={{ width: "100%", minWidth: 220 }}
          options={ingredients.map((i) => ({
            value: i.id,
            label: `${i.name} (${i.unit})`,
          }))}
        />
      ),
    },
    {
      title: "Quantity per dish",
      key: "quantity",
      width: 260,
      render: (_, r) => {
        const showsHint = r.unit && r.recipeUnit && r.recipeUnit !== r.unit;
        return (
          <div>
            <Space>
              <InputNumber
                min={0}
                step={0.1}
                value={r.quantity}
                onChange={(v) => patchRow(r.key, { quantity: Number(v ?? 0) })}
                style={{ width: 100 }}
              />
              <Select
                value={r.recipeUnit || undefined}
                placeholder="unit"
                onChange={(v) => patchRow(r.key, { recipeUnit: v })}
                style={{ width: 90 }}
                options={RECIPE_UNITS.map((u) => ({ value: u, label: u }))}
                disabled={r.ingredientId == null}
              />
            </Space>
            {showsHint && (
              <div style={{ fontSize: 10, color: "#8B5A00", marginTop: 4 }}>
                stored as <b>{r.unit}</b> → auto-converts
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Notes",
      key: "notes",
      render: (_, r) => (
        <Input
          placeholder="optional"
          value={r.notes}
          onChange={(e) => patchRow(r.key, { notes: e.target.value })}
        />
      ),
    },
    {
      title: "",
      key: "remove",
      width: 60,
      render: (_, r) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeRow(r.key)} />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={
        <Space>
          <Text strong>Recipe</Text>
          {itemName && <Tag color="blue">{itemName}</Tag>}
        </Space>
      }
      width={780}
      onCancel={onClose}
      onOk={save}
      okText="Save Recipe"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Each row is one ingredient and how much of it one unit of this dish consumes.
          You can pick a different unit than the ingredient's stored unit (e.g. beef stored in
          <b> kg</b>, recipe in <b>g</b>) — the app converts automatically before touching stock.
          Leaving the recipe empty disables stock tracking for this item.
        </Text>

        {draft.length === 0 ? (
          <Empty description="No recipe yet — click Add Ingredient to start" />
        ) : (
          <Table
            size="small"
            loading={loading}
            rowKey="key"
            columns={columns}
            dataSource={draft}
            pagination={false}
          />
        )}

        <Button type="dashed" icon={<PlusOutlined />} block onClick={addRow}>
          Add Ingredient
        </Button>
      </Space>
    </Modal>
  );
}
