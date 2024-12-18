// src/app/(admin)/surat/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2,
  Trash2,
  Upload,
  Download,
  Search,
  FileIcon,
  FileText,
} from "lucide-react";
import {
  getAllFormatSurat,
  uploadFormatSurat,
  deleteFormatSurat,
  trackFormatSuratDownload,
  getFormatSuratStats,
  FormatSurat,
  DownloadStats,
} from "@/api/suratApi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = [
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/pdf", // .pdf
];

const formatSuratSchema = z.object({
  nama: z.string().min(1, "Nama format surat harus diisi"),
  file: z
    .any()
    .optional()
    .superRefine((file, ctx) => {
      if (!file || !file[0]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "File harus dipilih",
        });
        return;
      }

      if (file[0].size > MAX_FILE_SIZE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ukuran file maksimal 5MB",
        });
        return;
      }

      if (!ACCEPTED_FILE_TYPES.includes(file[0].type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Format file harus .doc, .docx, atau .pdf",
        });
        return;
      }
    }),
});

type FormatSuratForm = z.infer<typeof formatSuratSchema>;

const AdminSuratPage: React.FC = () => {
  const { user } = useAuth(true);
  const [formatSurat, setFormatSurat] = useState<FormatSurat[]>([]);
  const [filteredFormat, setFilteredFormat] = useState<FormatSurat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [downloadStats, setDownloadStats] = useState<DownloadStats[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormatSuratForm>({
    resolver: zodResolver(formatSuratSchema),
    defaultValues: {
      nama: "",
    },
  });

  const fetchFormatSurat = useCallback(async () => {
    try {
      const data = await getAllFormatSurat();
      setFormatSurat(data);
      setFilteredFormat(data);
    } catch (err) {
      let errorMessage = "Tidak dapat memuat daftar format surat";
      if (err instanceof Error) {
        errorMessage += `: ${err.message}`;
      }
      toast({
        title: "Gagal memuat data",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Mengembalikan useCallback untuk fetchDownloadStats
  const fetchDownloadStats = useCallback(
    async (id: string) => {
      setLoadingStats(true);
      try {
        const stats = await getFormatSuratStats(id);

        // Handle kasus ketika tidak ada data statistik
        if (!stats || stats.length === 0) {
          const currentDate = new Date();
          const currentMonth = currentDate.toLocaleString("id-ID", {
            month: "long",
          });

          // Dapatkan format surat yang dipilih untuk mendapatkan total downloads
          const selectedFormat = formatSurat.find((f) => f.id === id);

          setDownloadStats([
            {
              month: currentMonth,
              year: currentDate.getFullYear(),
              downloadCount: selectedFormat?.totalDownloads || 0,
            },
          ]);
        } else {
          setDownloadStats(stats);
        }
      } catch (err: unknown) {
        let errorMessage = "Tidak dapat memuat statistik unduhan";
        if (err instanceof Error) {
          errorMessage += `: ${err.message}`;
        }
        toast({
          title: "Gagal memuat statistik",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoadingStats(false);
      }
    },
    [toast, formatSurat]
  );

  // Memperbaiki useEffect dengan dependency yang benar
  useEffect(() => {
    if (!user) return;
    fetchFormatSurat();
  }, [user, fetchFormatSurat]);

  useEffect(() => {
    const filtered = formatSurat.filter((format) =>
      format.nama.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredFormat(filtered);
  }, [searchQuery, formatSurat]);

  const onSubmit = async (data: FormatSuratForm) => {
    if (!data.file?.[0]) return;

    try {
      const formData = new FormData();
      formData.append("nama", data.nama);
      formData.append("file", data.file[0]);

      await uploadFormatSurat(formData);
      await fetchFormatSurat();
      form.reset();
      setSelectedFile(null);
      toast({
        title: "Berhasil!",
        description: "Format surat telah berhasil diunggah",
      });
    } catch {
      toast({
        title: "Gagal mengunggah",
        description: "Terjadi kesalahan saat mengunggah format surat",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFormatSurat(id);
      await fetchFormatSurat();
      if (selectedFormatId === id) {
        setSelectedFormatId(null);
        setDownloadStats([]);
      }
      toast({
        title: "Berhasil",
        description: "Format surat telah dihapus",
      });
    } catch {
      toast({
        title: "Gagal menghapus",
        description: "Terjadi kesalahan saat menghapus format surat",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = useCallback(
    async (format: FormatSurat) => {
      try {
        await trackFormatSuratDownload(format.id);
        window.open(format.downloadUrl, "_blank");
        // Refresh stats jika format ini sedang ditampilkan
        if (selectedFormatId === format.id) {
          await fetchDownloadStats(format.id);
        }
      } catch (err) {
        console.error("Error tracking download:", err);
        window.open(format.downloadUrl, "_blank");
      }
    },
    [selectedFormatId, fetchDownloadStats]
  );

  const handleShowStats = useCallback(
    async (id: string) => {
      setSelectedFormatId(id);
      await fetchDownloadStats(id);
    },
    [fetchDownloadStats]
  );

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid gap-8"
      >
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Format Surat
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatSurat.length}</div>
              <p className="text-xs text-muted-foreground">
                Format surat tersedia
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Download Statistics */}
        {selectedFormatId && (
          <Card>
            <CardHeader>
              <CardTitle>Statistik Unduhan</CardTitle>
              <CardDescription>
                {formatSurat.find((f) => f.id === selectedFormatId)?.nama}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : downloadStats.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={downloadStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        allowDecimals={false} // Hanya tampilkan angka bulat
                        domain={[0, "auto"]} // Mulai dari 0, maksimum otomatis
                        tickCount={5} // Batasi jumlah tick untuk kejelasan
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          Math.round(value),
                          "Unduhan",
                        ]} // Format angka bulat di tooltip
                      />
                      <Bar
                        dataKey="downloadCount"
                        fill="#3b82f6"
                        name="Jumlah Unduhan"
                        // Tambahkan label di atas bar jika ingin menampilkan angka
                        label={{
                          position: "top",
                          formatter: (value: number) => Math.round(value),
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <p>Belum ada data unduhan</p>
                  <p className="text-sm">
                    Statistik akan muncul setelah dokumen diunduh
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>Manajemen Format Surat</CardTitle>
            <CardDescription>
              Kelola format surat yang tersedia untuk diunduh oleh warga.
              Mendukung format .doc dan .docx dengan ukuran maksimal 5MB. 
               <span className="text-rose-400"> Hindari format PDF</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Upload Form */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="nama"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nama Format Surat</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Contoh: Surat Keterangan Domisili"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="file"
                      render={({ field: { ref, ...field } }) => (
                        <FormItem>
                          <FormLabel>File Template</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <Input
                                type="file"
                                accept=".doc,.docx,.pdf"
                                onChange={(e) => {
                                  field.onChange(e.target.files);
                                  if (e.target.files?.[0]) {
                                    setSelectedFile(e.target.files[0]);
                                  }
                                }}
                                ref={ref}
                                className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                                  file:text-sm file:bg-primary file:text-primary-foreground
                                  hover:file:bg-primary/90"
                              />
                              {selectedFile && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <FileIcon className="h-4 w-4" />
                                  {selectedFile.name}
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={form.formState.isSubmitting}
                        className="w-full sm:w-auto"
                      >
                        {form.formState.isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Mengunggah...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Unggah Format Surat
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Search and Table */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari format surat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredFormat.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">
                    Tidak ada format surat
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? "Tidak ada hasil yang cocok dengan pencarian Anda"
                      : "Mulai dengan mengunggah format surat baru"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Format Surat</TableHead>
                        <TableHead>Total Unduhan</TableHead>
                        <TableHead>Tanggal Dibuat</TableHead>
                        <TableHead>Terakhir Diperbarui</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFormat.map((format) => (
                        <TableRow key={format.id}>
                          <TableCell className="font-medium">
                            {format.nama}
                          </TableCell>
                          <TableCell>{format.totalDownloads ?? 0}</TableCell>
                          <TableCell>
                            {new Date(format.createdAt).toLocaleDateString(
                              "id-ID"
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(format.updatedAt).toLocaleDateString(
                              "id-ID"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShowStats(format.id)}
                                className="h-8 px-2"
                              >
                                Statistik
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(format)}
                                className="h-8 w-8 p-0"
                                title="Unduh format surat"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    disabled={deletingId === format.id}
                                  >
                                    {deletingId === format.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Hapus Format Surat
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Apakah Anda yakin ingin menghapus format
                                      surat &quot;{format.nama}&quot;? Tindakan
                                      ini tidak dapat dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(format.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Hapus
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminSuratPage;
