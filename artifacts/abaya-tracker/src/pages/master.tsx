import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { 
  useListCategories, useCreateCategory, getListCategoriesQueryKey,
  useListColors, useCreateColor, getListColorsQueryKey,
  useListSizes, useCreateSize, getListSizesQueryKey,
  useListFabrics, useCreateFabric, getListFabricsQueryKey,
  useListProducts, useCreateProduct, getListProductsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function MasterDataPage() {
  return (
    <AppLayout title="Master Data">
      <Tabs defaultValue="categories" className="w-full">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 inline-block overflow-x-auto max-w-full">
          <TabsList className="bg-transparent h-auto p-0 flex space-x-1">
            <TabsTrigger value="categories" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Categories</TabsTrigger>
            <TabsTrigger value="colors" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Colors</TabsTrigger>
            <TabsTrigger value="sizes" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Sizes</TabsTrigger>
            <TabsTrigger value="fabrics" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Fabrics</TabsTrigger>
            <TabsTrigger value="products" className="rounded-lg px-4 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-primary data-[state=active]:shadow-none">Products</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="categories" className="mt-0 outline-none"><CategoriesTab /></TabsContent>
        <TabsContent value="colors" className="mt-0 outline-none"><ColorsTab /></TabsContent>
        <TabsContent value="sizes" className="mt-0 outline-none"><SizesTab /></TabsContent>
        <TabsContent value="fabrics" className="mt-0 outline-none"><FabricsTab /></TabsContent>
        <TabsContent value="products" className="mt-0 outline-none"><ProductsTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function CategoriesTab() {
  const { data, isLoading } = useListCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const { mutate, isPending } = useCreateCategory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        setOpen(false);
        toast({ title: "Category created" });
      }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { name: fd.get("name") as string, description: fd.get("description") as string } });
  };

  return (
    <MasterCard title="Product Categories" onAdd={() => setOpen(true)} addLabel="Add Category" open={open} onOpenChange={setOpen}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Name</label>
          <input name="name" className="form-input-styled" required placeholder="e.g. Daily Wear" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Description</label>
          <input name="description" className="form-input-styled" placeholder="Optional details..." />
        </div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">
          {isPending ? "Saving..." : "Save Category"}
        </Button>
      </form>
      
      <div className="mt-6 border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></TableCell></TableRow> : 
              data?.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-slate-500">#{c.id}</TableCell>
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell className="text-slate-600">{c.description || "-"}</TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
  );
}

function ColorsTab() {
  const { data, isLoading } = useListColors();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateColor({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListColorsQueryKey() }); setOpen(false); }
    }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { name: fd.get("name") as string, code: fd.get("code") as string } });
  };

  return (
    <MasterCard title="Colors" onAdd={() => setOpen(true)} addLabel="Add Color" open={open} onOpenChange={setOpen}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div><label className="text-sm font-medium block mb-1.5">Color Name</label><input name="name" className="form-input-styled" required /></div>
        <div><label className="text-sm font-medium block mb-1.5">Color Code (Hex/Identifier)</label><input name="code" className="form-input-styled" /></div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Code</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              data?.map(c => (
                <TableRow key={c.id}>
                  <TableCell>#{c.id}</TableCell>
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell><span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono border">{c.code || "N/A"}</span></TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
  );
}

function SizesTab() {
  const { data, isLoading } = useListSizes();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateSize({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSizesQueryKey() }); setOpen(false); } }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { name: fd.get("name") as string, sortOrder: Number(fd.get("sortOrder")) } });
  };

  return (
    <MasterCard title="Sizes" onAdd={() => setOpen(true)} addLabel="Add Size" open={open} onOpenChange={setOpen}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div><label className="text-sm font-medium block mb-1.5">Size Name</label><input name="name" className="form-input-styled" required /></div>
        <div><label className="text-sm font-medium block mb-1.5">Sort Order</label><input type="number" name="sortOrder" className="form-input-styled" defaultValue="0" /></div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow><TableHead>ID</TableHead><TableHead>Size</TableHead><TableHead>Sort Order</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              data?.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(s => (
                <TableRow key={s.id}><TableCell>#{s.id}</TableCell><TableCell className="font-semibold">{s.name}</TableCell><TableCell>{s.sortOrder}</TableCell></TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
  );
}

function FabricsTab() {
  const { data, isLoading } = useListFabrics();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateFabric({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFabricsQueryKey() }); setOpen(false); } }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { name: fd.get("name") as string, description: fd.get("description") as string, unit: fd.get("unit") as string } });
  };

  return (
    <MasterCard title="Fabrics" onAdd={() => setOpen(true)} addLabel="Add Fabric" open={open} onOpenChange={setOpen}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div><label className="text-sm font-medium block mb-1.5">Fabric Name</label><input name="name" className="form-input-styled" required /></div>
        <div><label className="text-sm font-medium block mb-1.5">Unit (e.g. Meters, Yards)</label><input name="unit" className="form-input-styled" defaultValue="Meters" /></div>
        <div><label className="text-sm font-medium block mb-1.5">Description</label><input name="description" className="form-input-styled" /></div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow><TableHead>ID</TableHead><TableHead>Fabric</TableHead><TableHead>Unit</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              data?.map(f => (
                <TableRow key={f.id}><TableCell>#{f.id}</TableCell><TableCell className="font-semibold">{f.name}</TableCell><TableCell>{f.unit}</TableCell><TableCell>{f.description}</TableCell></TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
  );
}

function ProductsTab() {
  const { data, isLoading } = useListProducts();
  const { data: categories } = useListCategories();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateProduct({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); setOpen(false); } }
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate({ data: { 
      name: fd.get("name") as string, 
      code: fd.get("code") as string,
      categoryId: Number(fd.get("categoryId")),
      description: fd.get("description") as string 
    } });
  };

  return (
    <MasterCard title="Products / Designs" onAdd={() => setOpen(true)} addLabel="Add Product" open={open} onOpenChange={setOpen}>
      <form onSubmit={onSubmit} className="space-y-4 pt-4">
        <div><label className="text-sm font-medium block mb-1.5">Product Name/Design</label><input name="name" className="form-input-styled" required /></div>
        <div><label className="text-sm font-medium block mb-1.5">Design Code</label><input name="code" className="form-input-styled" required /></div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Category</label>
          <select name="categoryId" className="form-input-styled bg-white" required>
            <option value="">Select Category...</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="text-sm font-medium block mb-1.5">Description</label><input name="description" className="form-input-styled" /></div>
        <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl">Save</Button>
      </form>
      <div className="mt-6 border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow><TableHead>Code</TableHead><TableHead>Design Name</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> :
              data?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-slate-500 text-xs">{p.code}</TableCell>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell>{p.categoryName}</TableCell>
                  <TableCell><div className={`w-2 h-2 rounded-full ${p.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} /></TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
    </MasterCard>
  );
}

function MasterCard({ title, children, onAdd, addLabel, open, onOpenChange }: any) {
  return (
    <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-5 px-6">
        <CardTitle className="text-xl font-display text-slate-800">{title}</CardTitle>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button onClick={onAdd} className="rounded-xl shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 transition-all hover:-translate-y-0.5">
              <Plus className="h-4 w-4 mr-2" /> {addLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-2xl p-6 border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">{addLabel}</DialogTitle>
            </DialogHeader>
            {children[0]} {/* The Form */}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-6 bg-white">
        {children[1]} {/* The Table */}
      </CardContent>
    </Card>
  );
}
