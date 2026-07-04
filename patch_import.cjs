const fs = require('fs');
let code = fs.readFileSync('src/components/ClassDetail.tsx', 'utf8');

const targetLine = "import { ArrowLeft, Users, Shield, Plus, Minus, Star, Play, Trophy, Settings, Trash2, Edit2, X, AlertTriangle, Key, Copy, RefreshCw, Clock, Undo2, Folder, CheckSquare, PlusCircle, FileText, Paperclip, Loader2, Award, BarChart2, Printer, TrendingUp, Archive } from 'lucide-react';";
const replacement = "import { ArrowLeft, Users, Shield, Plus, Minus, Star, Play, Trophy, Settings, Trash2, Edit2, X, AlertTriangle, Key, Copy, RefreshCw, Clock, Undo2, Folder, CheckSquare, PlusCircle, FileText, Paperclip, Loader2, Award, BarChart2, Printer, TrendingUp, Archive, Activity } from 'lucide-react';";

if (code.includes(targetLine)) {
    code = code.replace(targetLine, replacement);
    fs.writeFileSync('src/components/ClassDetail.tsx', code);
    console.log("Success");
} else {
    console.log("Could not find target import");
}
