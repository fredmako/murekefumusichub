// My Arrangements Page
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

interface Arrangement {
  id: string;
  title: string;
  description: string;
  price: number;
  file_url: string;
  thumbnail_url: string;
  is_published: boolean;
  created_at: string;
}

export default function MyArrangements() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Arrangement | null>(null);
  const [form, setForm] = useState({ title: "", description: "", price: "0" });

  useEffect(() => {
    if (!appUser) return;
    fetch("/api/arrangements")
      .then(r => r.json())
      .then(data => {
        setArrangements(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [appUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editing ? `/api/arrangements/${editing.id}` : "/api/arrangements";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAuth()}` },
      body: JSON.stringify({ ...form, price: parseFloat(form.price) }),
    });
    if (res.ok) {
      toast.success(editing ? "Updated!" : "Created!");
      setDialogOpen(false);
      setEditing(null);
      setForm({ title: "", description: "", price: "0" });
      refresh();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/arrangements/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await getAuth()}` },
    });
    if (res.ok) {
      toast.success("Deleted!");
      refresh();
    }
  };

  const getAuth = async () => {
    return localStorage.getItem("murekefu_auth_token");
  };

  const refresh = () => {
    fetch("/api/arrangements")
      .then(r => r.json())
      .then(data => setArrangements(data || []));
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Arrangements</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Arrangement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "New"} Arrangement</DialogTitle>
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

      {arrangements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p>No arrangements yet. Create your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {arrangements.map(arr => (
            <Card key={arr.id}>
              <CardHeader>
                <CardTitle className="text-lg">{arr.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{arr.description}</p>
                <p className="font-bold mt-2">${arr.price}</p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => { setEditing(arr); setForm({ title: arr.title, description: arr.description, price: arr.price.toString() }); setDialogOpen(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(arr.id)}>
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
