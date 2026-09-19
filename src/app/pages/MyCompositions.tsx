// My Compositions Page
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import { toast } from "sonner";
import { Music, Plus, Trash2, Edit } from "lucide-react";

interface Composition {
  id: string;
  title: string;
  description: string;
  price: number;
  file_url: string;
  thumbnail_url: string;
  is_published: boolean;
  created_at: string;
}

export default function MyCompositions() {
  const navigate = useNavigate();
  const { appUser, isLoading: authLoading } = useAuth();
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Composition | null>(null);
  const [form, setForm] = useState({ title: "", description: "", price: "0" });

  useEffect(() => {
    if (authLoading) return;
    if (!appUser) return;
    
    fetch("/api/compositions/composer/" + appUser.id, {
      headers: { Authorization: `Bearer ${localStorage.getItem("murekefu_auth_token")}` },
    })
      .then(r => r.json())
      .then(data => {
        setCompositions(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [appUser, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editing ? `/api/compositions/${editing.id}` : "/api/compositions";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("murekefu_auth_token")}` },
      body: JSON.stringify({ ...form, price: parseFloat(form.price) }),
    });
    if (res.ok) {
      toast.success(editing ? "Updated!" : "Created!");
      setDialogOpen(false);
      setEditing(null);
      setForm({ title: "", description: "", price: "0" });
      refresh();
    } else {
      toast.error("Failed");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/compositions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("murekefu_auth_token")}` },
    });
    if (res.ok) {
      toast.success("Deleted!");
      refresh();
    }
  };

  const refresh = () => {
    if (!appUser) return;
    fetch("/api/compositions/composer/" + appUser.id, {
      headers: { Authorization: `Bearer ${localStorage.getItem("murekefu_auth_token")}` },
    })
      .then(r => r.json())
      .then(data => setCompositions(data || []));
  };

  if (authLoading || loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Compositions</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Composition</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "New"} Composition</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              <Textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <Input type="number" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              <Button type="submit">{editing ? "Update" : "Create"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {compositions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p>No compositions yet. Create your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {compositions.map(comp => (
            <Card key={comp.id}>
              <CardHeader>
                <CardTitle className="text-lg">{comp.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{comp.description}</p>
                <p className="font-bold mt-2">${comp.price}</p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => { setEditing(comp); setForm({ title: comp.title, description: comp.description, price: comp.price.toString() }); setDialogOpen(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(comp.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
