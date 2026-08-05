import {
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight,
  PanelLeft, PanelRight, PanelLeftClose, PanelRightClose,
  Send, Reply, Forward, Undo2, Redo2, CornerDownLeft,
  AlignLeft, AlignRight, IndentIncrease, IndentDecrease,
  Check, X, Plus, Minus, Search, Menu, MoreHorizontal,
  Settings, Bell, User, Users, Calendar, Clock, Tag, Flag,
  Filter, Download, Upload, Trash2, Edit3, Copy,
  FolderOpen, FileText, AlertCircle, Info, Loader2,
  Star, Heart, Share2, ExternalLink, Link2, Eye,
  EyeOff, MessageSquare, Paperclip, ChevronDown,
  ChevronUp, ChevronsUpDown, GripVertical, List,
  LayoutGrid, Maximize2, Minimize2, Sun, Moon,
  Monitor, LogOut, LogIn, PlusCircle,
} from "lucide-react";

export const icons = {
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight,
  PanelLeft, PanelRight, PanelLeftClose, PanelRightClose,
  Send, Reply, Forward, Undo2, Redo2, CornerDownLeft,
  AlignLeft, AlignRight, IndentIncrease, IndentDecrease,
  Check, X, Plus, Minus, Search, Menu, MoreHorizontal,
  Settings, Bell, User, Users, Calendar, Clock, Tag, Flag,
  Filter, Download, Upload, Trash2, Edit3, Copy,
  FolderOpen, FileText, AlertCircle, Info, Loader2,
  Star, Heart, Share2, ExternalLink, Link2, Eye,
  EyeOff, MessageSquare, Paperclip, ChevronDown,
  ChevronUp, ChevronUpDown: ChevronsUpDown, GripVertical, List,
  LayoutGrid, Maximize2, Minimize2, Sun, Moon,
  Monitor, LogOut, LogIn, PlusCircle,
} as const;

export type IconName = keyof typeof icons;
