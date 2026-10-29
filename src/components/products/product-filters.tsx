import Form from "next/form";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Category } from "@/lib/data/products";

// Filtros por GET: o estado fica na URL e a busca funciona sem JavaScript.
export function ProductFilters({
  categories,
  defaults,
}: {
  categories: Category[];
  defaults: { busca: string; categoria: string; status: string };
}) {
  return (
    <Form action="/produtos" className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor="busca">Buscar</Label>
        <Input
          id="busca"
          name="busca"
          type="search"
          placeholder="Nome ou SKU"
          defaultValue={defaults.busca}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoria">Categoria</Label>
        <NativeSelect id="categoria" name="categoria" defaultValue={defaults.categoria}>
          <NativeSelectOption value="">Todas</NativeSelectOption>
          {categories.map((category) => (
            <NativeSelectOption key={category.id} value={category.id}>
              {category.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <NativeSelect id="status" name="status" defaultValue={defaults.status}>
          <NativeSelectOption value="ativos">Ativos</NativeSelectOption>
          <NativeSelectOption value="inativos">Inativos</NativeSelectOption>
          <NativeSelectOption value="todos">Todos</NativeSelectOption>
        </NativeSelect>
      </div>
      <Button type="submit" variant="secondary">
        <Search aria-hidden />
        Filtrar
      </Button>
    </Form>
  );
}
