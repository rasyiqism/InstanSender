<script setup>
import { onMounted, reactive, ref } from "vue";
import api from "../../services/api";
import Card from "../../components/ui/Card.vue";
import Button from "../../components/ui/Button.vue";
import Badge from "../../components/ui/Badge.vue";
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users as UsersIcon,
  X,
} from "lucide-vue-next";

const users = ref([]);
const loading = ref(false);
const saving = ref("");
const error = ref("");
const showCreate = ref(false);
const editModal = ref({ open: false, user: null });
const deleteModal = ref({ open: false, user: null });
const createForm = reactive({
  name: "",
  email: "",
  password: "",
  role: "user",
});
const editForm = reactive({
  name: "",
  email: "",
  password: "",
  role: "user",
});

onMounted(fetchUsers);

async function fetchUsers() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get("/admin/users");
    users.value = data;
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to load users";
  } finally {
    loading.value = false;
  }
}

async function createUser() {
  saving.value = "create";
  error.value = "";
  try {
    await api.post("/admin/users", { ...createForm });
    Object.assign(createForm, {
      name: "",
      email: "",
      password: "",
      role: "user",
    });
    showCreate.value = false;
    await fetchUsers();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to create user";
  } finally {
    saving.value = "";
  }
}

function openEdit(user) {
  editModal.value = { open: true, user };
  Object.assign(editForm, {
    name: user.name ?? "",
    email: user.email ?? "",
    password: "",
    role: user.role ?? "user",
  });
}

function closeEdit() {
  editModal.value = { open: false, user: null };
}

function openDelete(user) {
  deleteModal.value = { open: true, user };
}

function closeDelete() {
  deleteModal.value = { open: false, user: null };
}

async function saveUser() {
  const user = editModal.value.user;
  if (!user) return;

  saving.value = user.id;
  error.value = "";
  const payload = {
    name: editForm.name,
    email: editForm.email,
    role: editForm.role,
  };
  if (editForm.password) payload.password = editForm.password;

  try {
    await api.patch(`/admin/users/${user.id}`, payload);
    closeEdit();
    await fetchUsers();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to save user";
  } finally {
    saving.value = "";
  }
}

async function deleteUser() {
  const user = deleteModal.value.user;
  if (!user) return;

  saving.value = user.id;
  error.value = "";
  try {
    await api.delete(`/admin/users/${user.id}`);
    closeDelete();
    await fetchUsers();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to delete user";
  } finally {
    saving.value = "";
  }
}
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Users
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Create, update, and remove dashboard accounts.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="fetchUsers">
          <RefreshCw class="h-4 w-4" />
          Refresh
        </Button>
        <Button variant="primary" @click="showCreate = !showCreate">
          <Plus class="h-4 w-4" />
          {{ showCreate ? "Close" : "Add User" }}
        </Button>
      </div>
    </div>

    <div
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <Card v-if="showCreate" class="p-5">
      <form
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        @submit.prevent="createUser"
      >
        <input
          v-model="createForm.name"
          required
          placeholder="Name"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model="createForm.email"
          required
          type="email"
          placeholder="Email"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model="createForm.password"
          required
          type="password"
          minlength="6"
          placeholder="Password"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <select
          v-model="createForm.role"
          class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <Button type="submit" :disabled="saving === 'create'">
          <Loader2 v-if="saving === 'create'" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          Create
        </Button>
      </form>
    </Card>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading users...</span>
    </div>

    <Card
      v-else-if="!users.length"
      class="flex flex-col items-center p-12 text-center"
    >
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary"
      >
        <UsersIcon class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">No users found</p>
      <p class="mt-1 text-sm text-slate-500">
        Add a user to start managing accounts.
      </p>
    </Card>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-slate-200 bg-white"
    >
      <table class="min-w-[980px] w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3">Role</th>
            <th class="px-4 py-3">Joined</th>
            <th class="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-t align-top">
            <td class="px-4 py-3">
              <p class="font-medium text-slate-900">{{ u.name }}</p>
            </td>
            <td class="px-4 py-3">
              <p class="text-slate-600">{{ u.email }}</p>
            </td>
            <td class="px-4 py-3">
              <Badge
                :variant="u.role === 'admin' ? 'destructive' : 'secondary'"
              >
                {{ u.role }}
              </Badge>
            </td>
            <td class="px-4 py-3 text-sm text-slate-500">
              {{
                new Date(u.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              }}
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="saving === u.id"
                  @click="openEdit(u)"
                >
                  <Pencil class="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  class="text-red-600 hover:bg-red-50 hover:text-red-700"
                  :disabled="saving === u.id"
                  @click="openDelete(u)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="editModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeEdit"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-0 shadow-2xl">
        <div
          class="flex items-center justify-between border-b border-slate-100 px-5 py-4"
        >
          <div>
            <h3 class="font-semibold text-slate-900">Edit User</h3>
            <p class="mt-1 text-xs text-slate-500">
              Update account details and optional password.
            </p>
          </div>
          <Button variant="ghost" size="icon" @click="closeEdit">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <form class="space-y-4 p-5" @submit.prevent="saveUser">
          <div>
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >Name</label
            >
            <input
              v-model="editForm.name"
              required
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >Email</label
            >
            <input
              v-model="editForm.email"
              required
              type="email"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >Role</label
            >
            <select
              v-model="editForm.role"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >New Password</label
            >
            <input
              v-model="editForm.password"
              type="password"
              minlength="6"
              placeholder="Leave unchanged"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" @click="closeEdit"
              >Cancel</Button
            >
            <Button type="submit" :disabled="saving === editModal.user?.id">
              <Loader2
                v-if="saving === editModal.user?.id"
                class="h-4 w-4 animate-spin"
              />
              <Save v-else class="h-4 w-4" />
              Save
            </Button>
          </div>
        </form>
      </Card>
    </div>

    <div
      v-if="deleteModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeDelete"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-5 shadow-2xl">
        <div class="flex items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"
          >
            <Trash2 class="h-5 w-5" />
          </div>
          <div>
            <h3 class="font-semibold text-slate-900">Delete User</h3>
            <p class="mt-2 text-sm text-slate-500">
              Delete {{ deleteModal.user?.email }} and all related account data?
            </p>
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <Button variant="outline" @click="closeDelete">Cancel</Button>
          <Button
            variant="destructive"
            :disabled="saving === deleteModal.user?.id"
            @click="deleteUser"
          >
            <Loader2
              v-if="saving === deleteModal.user?.id"
              class="h-4 w-4 animate-spin"
            />
            <Trash2 v-else class="h-4 w-4" />
            Delete
          </Button>
        </div>
      </Card>
    </div>
  </div>
</template>
