--
-- PostgreSQL database dump
--

\restrict kpRoMjh00tgjXdqnDdvkcFFveMng3Z08ebeEc2GNMjyerEGWHBEw06P0tutsTwg

-- Dumped from database version 16.14 (3cbc516)
-- Dumped by pg_dump version 16.14 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: care_plan_tasks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.care_plan_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    care_plan_id uuid NOT NULL,
    user_id uuid NOT NULL,
    profile_id uuid,
    title text NOT NULL,
    description text,
    category text,
    is_completed boolean DEFAULT false,
    due_date date,
    completed_at timestamp without time zone,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT care_plan_tasks_category_check CHECK ((category = ANY (ARRAY['medication'::text, 'lifestyle'::text, 'diet'::text, 'symptom_check'::text, 'appointment'::text, 'general'::text])))
);


ALTER TABLE public.care_plan_tasks OWNER TO neondb_owner;

--
-- Name: care_plans; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.care_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_id uuid,
    record_id uuid,
    status text DEFAULT 'active'::text,
    version integer DEFAULT 1,
    parent_plan_id uuid,
    start_date date,
    end_date date,
    duration_days integer,
    progress_percentage integer DEFAULT 0,
    summary text,
    disclaimer text,
    raw_ai_output jsonb,
    diet_recommendations jsonb,
    lifestyle_recommendations jsonb,
    watch_for_symptoms jsonb,
    follow_up_appointments jsonb,
    clarification_status text DEFAULT 'complete'::text,
    pending_questions jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT care_plans_clarification_status_check CHECK ((clarification_status = ANY (ARRAY['pending_questions'::text, 'complete'::text]))),
    CONSTRAINT care_plans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])))
);


ALTER TABLE public.care_plans OWNER TO neondb_owner;

--
-- Name: caregiver_access; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.caregiver_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    caregiver_user_id uuid NOT NULL,
    permissions jsonb DEFAULT '{"add_records": false, "view_records": true, "view_care_plans": true, "manage_reminders": false}'::jsonb,
    status text DEFAULT 'pending'::text,
    invited_at timestamp without time zone DEFAULT now(),
    accepted_at timestamp without time zone,
    CONSTRAINT caregiver_access_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'revoked'::text])))
);


ALTER TABLE public.caregiver_access OWNER TO neondb_owner;

--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_id uuid,
    related_care_plan_id uuid,
    related_record_id uuid,
    title text,
    conversation_type text DEFAULT 'general'::text,
    created_at timestamp without time zone DEFAULT now(),
    last_message_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chat_conversations_conversation_type_check CHECK ((conversation_type = ANY (ARRAY['general'::text, 'care_plan'::text, 'lab_report'::text, 'medication'::text, 'symptoms'::text])))
);


ALTER TABLE public.chat_conversations OWNER TO neondb_owner;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    context_snapshot jsonb,
    was_flagged boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


ALTER TABLE public.chat_messages OWNER TO neondb_owner;

--
-- Name: lab_results; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lab_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_id uuid,
    record_id uuid,
    parameter text NOT NULL,
    value text NOT NULL,
    unit text,
    reference_range text,
    status text,
    test_date date,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT lab_results_status_check CHECK ((status = ANY (ARRAY['normal'::text, 'borderline'::text, 'abnormal'::text])))
);


ALTER TABLE public.lab_results OWNER TO neondb_owner;

--
-- Name: medications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.medications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_id uuid,
    care_plan_id uuid,
    name text NOT NULL,
    dosage text,
    frequency text,
    timing text,
    duration text,
    instructions text,
    source text DEFAULT 'manual'::text,
    is_active boolean DEFAULT true,
    start_date date,
    end_date date,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT medications_source_check CHECK ((source = ANY (ARRAY['care_plan'::text, 'manual'::text])))
);


ALTER TABLE public.medications OWNER TO neondb_owner;

--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE public.pgmigrations OWNER TO neondb_owner;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pgmigrations_id_seq OWNER TO neondb_owner;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id uuid NOT NULL,
    name text NOT NULL,
    relationship text NOT NULL,
    gender text,
    date_of_birth date,
    blood_group text,
    abha_number text,
    abha_address text,
    abha_linked boolean DEFAULT false,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    height_cm numeric,
    is_onboarding_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT profiles_blood_group_check CHECK ((blood_group = ANY (ARRAY['A+'::text, 'A-'::text, 'B+'::text, 'B-'::text, 'AB+'::text, 'AB-'::text, 'O+'::text, 'O-'::text, 'unknown'::text]))),
    CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text]))),
    CONSTRAINT profiles_relationship_check CHECK ((relationship = ANY (ARRAY['self'::text, 'spouse'::text, 'parent'::text, 'child'::text, 'sibling'::text, 'other'::text])))
);


ALTER TABLE public.profiles OWNER TO neondb_owner;

--
-- Name: records; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_id uuid,
    type text NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_public_id text NOT NULL,
    notes text,
    uploaded_at timestamp without time zone DEFAULT now(),
    CONSTRAINT records_type_check CHECK ((type = ANY (ARRAY['prescription'::text, 'lab_report'::text])))
);


ALTER TABLE public.records OWNER TO neondb_owner;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.refresh_tokens OWNER TO neondb_owner;

--
-- Name: reminder_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reminder_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reminder_id uuid NOT NULL,
    user_id uuid NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    status text,
    notes text,
    logged_at timestamp without time zone DEFAULT now(),
    CONSTRAINT reminder_logs_status_check CHECK ((status = ANY (ARRAY['taken'::text, 'missed'::text, 'snoozed'::text, 'completed'::text, 'skipped'::text])))
);


ALTER TABLE public.reminder_logs OWNER TO neondb_owner;

--
-- Name: reminders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_id uuid,
    medication_id uuid,
    care_plan_id uuid,
    care_plan_task_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    scheduled_time time without time zone NOT NULL,
    days_of_week text[],
    recurrence text DEFAULT 'daily'::text,
    start_date date,
    end_date date,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT reminders_recurrence_check CHECK ((recurrence = ANY (ARRAY['once'::text, 'daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT reminders_type_check CHECK ((type = ANY (ARRAY['medication'::text, 'appointment'::text, 'lifestyle'::text, 'water_intake'::text, 'exercise'::text, 'symptom_check'::text, 'custom'::text])))
);


ALTER TABLE public.reminders OWNER TO neondb_owner;

--
-- Name: symptom_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.symptom_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_id uuid,
    care_plan_id uuid,
    symptom text NOT NULL,
    severity text,
    notes text,
    logged_at timestamp without time zone DEFAULT now(),
    CONSTRAINT symptom_logs_severity_check CHECK ((severity = ANY (ARRAY['mild'::text, 'moderate'::text, 'severe'::text])))
);


ALTER TABLE public.symptom_logs OWNER TO neondb_owner;

--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: vitals; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vitals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_id uuid,
    type text NOT NULL,
    value_primary numeric NOT NULL,
    value_secondary numeric,
    unit text NOT NULL,
    timing_context text,
    notes text,
    recorded_at timestamp without time zone DEFAULT now(),
    CONSTRAINT vitals_type_check CHECK ((type = ANY (ARRAY['blood_pressure'::text, 'blood_glucose'::text, 'weight'::text, 'temperature'::text, 'heart_rate'::text, 'oxygen_saturation'::text])))
);


ALTER TABLE public.vitals OWNER TO neondb_owner;

--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: care_plan_tasks care_plan_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.care_plan_tasks
    ADD CONSTRAINT care_plan_tasks_pkey PRIMARY KEY (id);


--
-- Name: care_plans care_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_pkey PRIMARY KEY (id);


--
-- Name: caregiver_access caregiver_access_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.caregiver_access
    ADD CONSTRAINT caregiver_access_pkey PRIMARY KEY (id);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);


--
-- Name: medications medications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_abha_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_abha_number_key UNIQUE (abha_number);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: records records_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);


--
-- Name: reminder_logs reminder_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reminder_logs
    ADD CONSTRAINT reminder_logs_pkey PRIMARY KEY (id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: symptom_logs symptom_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.symptom_logs
    ADD CONSTRAINT symptom_logs_pkey PRIMARY KEY (id);


--
-- Name: caregiver_access unique_caregiver_profile; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.caregiver_access
    ADD CONSTRAINT unique_caregiver_profile UNIQUE (profile_id, caregiver_user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vitals vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_pkey PRIMARY KEY (id);


--
-- Name: care_plan_tasks_care_plan_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX care_plan_tasks_care_plan_id_index ON public.care_plan_tasks USING btree (care_plan_id);


--
-- Name: care_plans_profile_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX care_plans_profile_id_index ON public.care_plans USING btree (profile_id);


--
-- Name: care_plans_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX care_plans_user_id_index ON public.care_plans USING btree (user_id);


--
-- Name: caregiver_access_caregiver_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX caregiver_access_caregiver_user_id_index ON public.caregiver_access USING btree (caregiver_user_id);


--
-- Name: caregiver_access_profile_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX caregiver_access_profile_id_index ON public.caregiver_access USING btree (profile_id);


--
-- Name: chat_conversations_profile_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX chat_conversations_profile_id_index ON public.chat_conversations USING btree (profile_id);


--
-- Name: chat_conversations_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX chat_conversations_user_id_index ON public.chat_conversations USING btree (user_id);


--
-- Name: chat_messages_conversation_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX chat_messages_conversation_id_index ON public.chat_messages USING btree (conversation_id);


--
-- Name: chat_messages_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX chat_messages_user_id_index ON public.chat_messages USING btree (user_id);


--
-- Name: lab_results_record_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX lab_results_record_id_index ON public.lab_results USING btree (record_id);


--
-- Name: lab_results_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX lab_results_user_id_index ON public.lab_results USING btree (user_id);


--
-- Name: medications_care_plan_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX medications_care_plan_id_index ON public.medications USING btree (care_plan_id);


--
-- Name: medications_profile_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX medications_profile_id_index ON public.medications USING btree (profile_id);


--
-- Name: medications_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX medications_user_id_index ON public.medications USING btree (user_id);


--
-- Name: profiles_owner_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX profiles_owner_user_id_index ON public.profiles USING btree (owner_user_id);


--
-- Name: records_profile_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX records_profile_id_index ON public.records USING btree (profile_id);


--
-- Name: records_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX records_user_id_index ON public.records USING btree (user_id);


--
-- Name: refresh_tokens_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX refresh_tokens_user_id_index ON public.refresh_tokens USING btree (user_id);


--
-- Name: reminder_logs_reminder_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX reminder_logs_reminder_id_index ON public.reminder_logs USING btree (reminder_id);


--
-- Name: reminder_logs_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX reminder_logs_user_id_index ON public.reminder_logs USING btree (user_id);


--
-- Name: reminders_profile_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX reminders_profile_id_index ON public.reminders USING btree (profile_id);


--
-- Name: reminders_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX reminders_user_id_index ON public.reminders USING btree (user_id);


--
-- Name: symptom_logs_profile_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX symptom_logs_profile_id_index ON public.symptom_logs USING btree (profile_id);


--
-- Name: symptom_logs_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX symptom_logs_user_id_index ON public.symptom_logs USING btree (user_id);


--
-- Name: vitals_profile_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vitals_profile_id_index ON public.vitals USING btree (profile_id);


--
-- Name: vitals_user_id_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vitals_user_id_index ON public.vitals USING btree (user_id);


--
-- Name: vitals_user_id_type_index; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vitals_user_id_type_index ON public.vitals USING btree (user_id, type);


--
-- Name: care_plan_tasks care_plan_tasks_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.care_plan_tasks
    ADD CONSTRAINT care_plan_tasks_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(id) ON DELETE CASCADE;


--
-- Name: care_plan_tasks care_plan_tasks_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.care_plan_tasks
    ADD CONSTRAINT care_plan_tasks_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: care_plan_tasks care_plan_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.care_plan_tasks
    ADD CONSTRAINT care_plan_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: care_plans care_plans_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: care_plans care_plans_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.records(id) ON DELETE SET NULL;


--
-- Name: care_plans care_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: caregiver_access caregiver_access_caregiver_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.caregiver_access
    ADD CONSTRAINT caregiver_access_caregiver_user_id_fkey FOREIGN KEY (caregiver_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: caregiver_access caregiver_access_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.caregiver_access
    ADD CONSTRAINT caregiver_access_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_conversations chat_conversations_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_conversations chat_conversations_related_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_related_care_plan_id_fkey FOREIGN KEY (related_care_plan_id) REFERENCES public.care_plans(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_related_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_related_record_id_fkey FOREIGN KEY (related_record_id) REFERENCES public.records(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: care_plans fk_care_plans_parent; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT fk_care_plans_parent FOREIGN KEY (parent_plan_id) REFERENCES public.care_plans(id) ON DELETE SET NULL;


--
-- Name: lab_results lab_results_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: lab_results lab_results_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.records(id) ON DELETE SET NULL;


--
-- Name: lab_results lab_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: medications medications_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(id) ON DELETE SET NULL;


--
-- Name: medications medications_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: medications medications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: records records_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: records records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reminder_logs reminder_logs_reminder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reminder_logs
    ADD CONSTRAINT reminder_logs_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES public.reminders(id) ON DELETE CASCADE;


--
-- Name: reminder_logs reminder_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reminder_logs
    ADD CONSTRAINT reminder_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(id) ON DELETE SET NULL;


--
-- Name: reminders reminders_care_plan_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_care_plan_task_id_fkey FOREIGN KEY (care_plan_task_id) REFERENCES public.care_plan_tasks(id) ON DELETE SET NULL;


--
-- Name: reminders reminders_medication_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: symptom_logs symptom_logs_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.symptom_logs
    ADD CONSTRAINT symptom_logs_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(id) ON DELETE SET NULL;


--
-- Name: symptom_logs symptom_logs_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.symptom_logs
    ADD CONSTRAINT symptom_logs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: symptom_logs symptom_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.symptom_logs
    ADD CONSTRAINT symptom_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vitals vitals_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vitals vitals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict kpRoMjh00tgjXdqnDdvkcFFveMng3Z08ebeEc2GNMjyerEGWHBEw06P0tutsTwg

