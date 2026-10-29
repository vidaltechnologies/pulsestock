import Form from "next/form";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Category } from "@/lib/data/products";
import { getI18n } from "@/lib/i18n/server";

// Filtros por GET: o estado fica na URL e a busca funciona sem JavaScript.
export async function ProductFilters({
  categories,
  defaults,
}: {
  categories: Category[];
  defaults: { busca: string; categoria: string; status: string };
}) {
  const { t } = await getI18n();
  return (
    <Form action="/produtos" className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor="busca">{t.common.search}</Label>
        <Input
          id="busca"
          name="busca"
          type="search"
          placeholder={t.products.searchPlaceholder}
          defaultValue={defaults.busca}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoria">{t.products.category}</Label>
        <NativeSelect id="categoria" name="categoria" defaultValue={defaults.categoria}>
          <NativeSelectOption value="">{t.products.allCategories}</NativeSelectOption>
          {categories.map((category) => (
            <NativeSelectOption key={category.id} value={category.id}>
              {category.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">{t.common.status}</Label>
        <NativeSelect id="status" name="status" defaultValue={defaults.status}>
          <NativeSelectOption value="ativos">{t.common.activePlural}</NativeSelectOption>
          <NativeSelectOption value="inativos">{t.common.inactivePlural}</NativeSelectOption>
          <NativeSelectOption value="todos">{t.common.all}</NativeSelectOption>
        </NativeSelect>
      </div>
      <Button type="submit" variant="secondary">
        <Search aria-hidden />
        {t.common.filter}
      </Button>
    </Form>
  );
}
