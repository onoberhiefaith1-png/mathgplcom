import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SubjectTopics from "./pages/SubjectTopics.tsx";
import TopicSubtopics from "./pages/TopicSubtopics.tsx";
import SubtopicGame from "./pages/SubtopicGame.tsx";
import Auth from "./pages/Auth.tsx";
import Assets from "./pages/Assets.tsx";
import AssetCategory from "./pages/AssetCategory.tsx";
import AssetSubcategory from "./pages/AssetSubcategory.tsx";
import Backgrounds from "./pages/Backgrounds.tsx";
import TallyGame from "./pages/TallyGame.tsx";
import RomanGame from "./pages/RomanGame.tsx";
import LevelContent from "./pages/LevelContent.tsx";
import AbacusHub from "./pages/AbacusHub.tsx";
import AbacusRepresent from "./pages/AbacusRepresent.tsx";
import AbacusComingSoon from "./pages/AbacusComingSoon.tsx";
import PlaceValueHub from "./pages/PlaceValueHub.tsx";
import PlaceValueGame from "./pages/PlaceValueGame.tsx";
import AdditionHub from "./pages/AdditionHub.tsx";
import AdditionGame from "./pages/AdditionGame.tsx";
import SubtractionHub from "./pages/SubtractionHub.tsx";
import SubtractionGame from "./pages/SubtractionGame.tsx";
import MultiplicationHub from "./pages/MultiplicationHub.tsx";
import MultiplicationGame from "./pages/MultiplicationGame.tsx";
import DivisionHub from "./pages/DivisionHub.tsx";
import DivisionGame from "./pages/DivisionGame.tsx";
import BidmasHub from "./pages/BidmasHub.tsx";
import BidmasGame from "./pages/BidmasGame.tsx";
import FactorHub from "./pages/FactorHub.tsx";
import FactorGame from "./pages/FactorGame.tsx";
import PrimeHub from "./pages/PrimeHub.tsx";
import PrimeGame from "./pages/PrimeGame.tsx";
import PrimeFactorsHub from "./pages/PrimeFactorsHub.tsx";
import PrimeFactorsGame from "./pages/PrimeFactorsGame.tsx";
import CommonFactorsHub from "./pages/CommonFactorsHub.tsx";
import CommonFactorsGame from "./pages/CommonFactorsGame.tsx";
import LcmHub from "./pages/LcmHub.tsx";
import LcmGame from "./pages/LcmGame.tsx";
import { FractionsImproperHub, FractionsMixedHub } from "./pages/FractionsHubs.tsx";
import FractionsImproperGame from "./pages/FractionsImproperGame.tsx";
import FractionsMixedGame from "./pages/FractionsMixedGame.tsx";
import MathBoardPage from "./pages/MathBoardPage.tsx";
import SmartBoardPage from "./pages/SmartBoardPage.tsx";
import { FractionAdditionHub, FractionSubtractionHub, FractionMixedHub, FractionMultiplicationHub, FractionDivisionHub, FractionMulDivHub } from "./pages/FractionChallengeHub.tsx";
import { FractionAdditionGame, FractionSubtractionGame, FractionMixedGame, FractionMultiplicationGame, FractionDivisionGame, FractionMulDivGame } from "./pages/FractionChallengeGame.tsx";
import DecimalsHub from "./pages/DecimalsHub.tsx";
import DecimalChallengeHub from "./pages/DecimalChallengeHub.tsx";
import DecimalChallengeGame from "./pages/DecimalChallengeGame.tsx";
import LessonNotesPage from "./pages/LessonNotesPage.tsx";
import NotebookEditorPage from "./pages/NotebookEditorPage.tsx";
import NotebookScanMobile from "./pages/NotebookScanMobile.tsx";
import FloatingNumbersPage from "./pages/FloatingNumbersPage.tsx";
import FloatingPreparationPage from "./pages/FloatingPreparationPage.tsx";
import TeachingHub from "./pages/TeachingHub.tsx";
import TeachingHubClasses from "./pages/TeachingHubClasses.tsx";
import TeachingHubSettings from "./pages/TeachingHubSettings.tsx";
import TeachingHubArchive from "./pages/TeachingHubArchive.tsx";
import CreateClassPage from "./pages/CreateClassPage.tsx";
import ClassDashboardPage from "./pages/ClassDashboardPage.tsx";
import StudentsPage from "./pages/class/StudentsPage.tsx";
import ClassLessonNotesPage from "./pages/class/ClassLessonNotesPage.tsx";
import ClassAssignmentsPage from "./pages/class/ClassAssignmentsPage.tsx";
import ClassSmartBoardLauncher from "./pages/class/ClassSmartBoardLauncher.tsx";
import JoinClassPage from "./pages/JoinClassPage.tsx";
import StudentClassPage from "./pages/student/StudentClassPage.tsx";
import StudentSmartBoardPage from "./pages/student/StudentSmartBoardPage.tsx";
import AssessmentBoardPage from "./pages/student/AssessmentBoardPage.tsx";
import { registerRealtimeAuthSync } from "./lib/realtime/auth";

// Keep the realtime socket authenticated so private channels stay authorized.
registerRealtimeAuthSync();

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/teaching-hub" element={<TeachingHub />} />
          <Route path="/teaching-hub/classes" element={<TeachingHubClasses />} />
          <Route path="/teaching-hub/classes/create" element={<CreateClassPage />} />
          <Route path="/teaching-hub/classes/:classId" element={<ClassDashboardPage />} />
          <Route path="/teaching-hub/classes/:classId/students" element={<StudentsPage />} />
          <Route path="/teaching-hub/classes/:classId/lesson-notes" element={<ClassLessonNotesPage />} />
          <Route path="/teaching-hub/classes/:classId/assignments" element={<ClassAssignmentsPage />} />
          <Route path="/teaching-hub/classes/:classId/smartboard" element={<ClassSmartBoardLauncher />} />
          <Route path="/teaching-hub/settings" element={<TeachingHubSettings />} />
          <Route path="/teaching-hub/settings/archive" element={<TeachingHubArchive />} />
          <Route path="/join" element={<JoinClassPage />} />
          <Route path="/join/:code" element={<JoinClassPage />} />
          <Route path="/student/class/:classId" element={<StudentClassPage />} />
          <Route path="/student/class/:classId/smartboard" element={<StudentSmartBoardPage />} />
          <Route path="/student/class/:classId/assessment/:assessmentId" element={<AssessmentBoardPage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/backgrounds" element={<Backgrounds />} />
          <Route path="/games/tally" element={<TallyGame />} />
          <Route path="/games/roman" element={<RomanGame />} />
          <Route path="/games/abacus/represent" element={<AbacusRepresent />} />
          <Route path="/games/abacus/represent/:difficulty" element={<AbacusRepresent />} />
          <Route path="/games/abacus/:mode" element={<AbacusComingSoon />} />
          <Route path="/games/place-value" element={<PlaceValueHub />} />
          <Route path="/games/place-value/:difficulty" element={<PlaceValueGame />} />
          <Route path="/games/addition" element={<AdditionHub />} />
          <Route path="/games/addition/:difficulty" element={<AdditionGame />} />
          <Route path="/games/subtraction" element={<SubtractionHub />} />
          <Route path="/games/subtraction/:difficulty" element={<SubtractionGame />} />
          <Route path="/games/multiplication" element={<MultiplicationHub />} />
          <Route path="/games/multiplication/:difficulty" element={<MultiplicationGame />} />
          <Route path="/games/division" element={<DivisionHub />} />
          <Route path="/games/division/:difficulty" element={<DivisionGame />} />
          <Route path="/games/bidmas" element={<BidmasHub />} />
          <Route path="/games/bidmas/:difficulty" element={<BidmasGame />} />
          <Route path="/games/factors" element={<FactorHub />} />
          <Route path="/games/factors/:difficulty" element={<FactorGame />} />
          <Route path="/games/prime" element={<PrimeHub />} />
          <Route path="/games/prime/:difficulty" element={<PrimeGame />} />
          <Route path="/games/prime-factors" element={<PrimeFactorsHub />} />
          <Route path="/games/prime-factors/:difficulty" element={<PrimeFactorsGame />} />
          <Route path="/games/common-factors" element={<CommonFactorsHub />} />
          <Route path="/games/common-factors/:difficulty" element={<CommonFactorsGame />} />
          <Route path="/games/lcm" element={<LcmHub />} />
          <Route path="/games/lcm/:difficulty" element={<LcmGame />} />
          <Route path="/games/fractions/improper-to-mixed" element={<FractionsImproperHub />} />
          <Route path="/games/fractions/improper-to-mixed/:difficulty" element={<FractionsImproperGame />} />
          <Route path="/games/fractions/mixed-to-improper" element={<FractionsMixedHub />} />
          <Route path="/games/fractions/mixed-to-improper/:difficulty" element={<FractionsMixedGame />} />
          <Route path="/mathboard" element={<MathBoardPage />} />
          <Route path="/smartboard" element={<SmartBoardPage />} />
          <Route path="/smartboard/:notebookId" element={<SmartBoardPage />} />
          <Route path="/lesson-notes" element={<LessonNotesPage />} />
          <Route path="/lesson-notes/:id" element={<NotebookEditorPage />} />
          <Route path="/lesson-notes/:notebookId/floating-prep/:subsectionId" element={<FloatingPreparationPage />} />
          <Route path="/lesson-notes/:notebookId/floating/:subsectionId" element={<FloatingNumbersPage />} />
          <Route path="/notebook-scan/:code" element={<NotebookScanMobile />} />
          <Route path="/games/fraction-challenge/addition" element={<FractionAdditionHub />} />
          <Route path="/games/fraction-challenge/addition/:difficulty" element={<FractionAdditionGame />} />
          <Route path="/games/fraction-challenge/subtraction" element={<FractionSubtractionHub />} />
          <Route path="/games/fraction-challenge/subtraction/:difficulty" element={<FractionSubtractionGame />} />
          <Route path="/games/fraction-challenge/mixed" element={<FractionMixedHub />} />
          <Route path="/games/fraction-challenge/mixed/:difficulty" element={<FractionMixedGame />} />
          <Route path="/games/fraction-challenge/multiplication" element={<FractionMultiplicationHub />} />
          <Route path="/games/fraction-challenge/multiplication/:difficulty" element={<FractionMultiplicationGame />} />
          <Route path="/games/fraction-challenge/division" element={<FractionDivisionHub />} />
          <Route path="/games/fraction-challenge/division/:difficulty" element={<FractionDivisionGame />} />
          <Route path="/games/fraction-challenge/mul-div" element={<FractionMulDivHub />} />
          <Route path="/games/fraction-challenge/mul-div/:difficulty" element={<FractionMulDivGame />} />
          <Route path="/games/decimals" element={<DecimalsHub />} />
          <Route path="/games/decimals/:kind" element={<DecimalChallengeHub />} />
          <Route path="/games/decimals/:kind/:difficulty" element={<DecimalChallengeGame />} />
          <Route path="/subjects/algebra/numbers-and-numerals/abacus" element={<AbacusHub />} />
          <Route path="/levels/:id" element={<LevelContent mode="level" />} />
          <Route path="/age/:range" element={<LevelContent mode="age" />} />
          <Route path="/grade/:n" element={<LevelContent mode="grade" />} />
          <Route path="/year/:n" element={<LevelContent mode="year" />} />
          <Route path="/class/:code" element={<LevelContent mode="class" />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/assets/:category" element={<AssetCategory />} />
          <Route path="/assets/:category/:subcategory" element={<AssetSubcategory />} />
          <Route path="/subjects/:subject" element={<SubjectTopics />} />
          <Route path="/subjects/:subject/:topic" element={<TopicSubtopics />} />
          <Route path="/subjects/:subject/:topic/:subtopic" element={<SubtopicGame />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
